import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { submitCodeSchema, submitMcqSchema } from '@enrich-skills/shared';
import { requireTenant, authenticate } from '../lib/tenant.js';

export async function attemptRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempts = await prisma.attempt.findMany({
      where: { userId: user.sub },
      include: { test: { select: { title: true } } },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return reply.send(attempts);
  });

  app.post('/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { sub: string; tenantId: string };
    const body = request.body as { testId: string };
    if (!body.testId) {
      return reply.status(400).send({ error: 'testId required' });
    }

    const test = await prisma.test.findFirst({
      where: { id: body.testId, tenantId: user.tenantId },
      include: { testQuestions: { include: { question: true }, orderBy: { order: 'asc' } } },
    });
    if (!test) return reply.status(404).send({ error: 'Test not found' });

    const config = test.config as { attemptLimit?: number };
    const existingCount = await prisma.attempt.count({
      where: { userId: user.sub, testId: body.testId },
    });
    if (config.attemptLimit && existingCount >= config.attemptLimit) {
      return reply.status(403).send({ error: 'Attempt limit reached' });
    }

    const attempt = await prisma.attempt.create({
      data: {
        userId: user.sub,
        testId: body.testId,
        status: 'in_progress',
        submissions: {
          create: test.testQuestions.map((tq) => ({
            questionId: tq.questionId,
            status: 'pending',
          })),
        },
      },
      include: {
        test: { include: { testQuestions: { include: { question: { include: { testCases: { where: { isPublic: true } } } } }, orderBy: { order: 'asc' } } } },
        submissions: true,
      },
    });

    return reply.status(201).send(attempt);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub },
      include: {
        test: { include: { testQuestions: { include: { question: true }, orderBy: { order: 'asc' } } } },
        submissions: { include: { question: true } },
      },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found' });
    return reply.send(attempt);
  });

  app.post('/:id/submit-code', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const parsed = submitCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { questionId, code, language } = parsed.data;

    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub, status: 'in_progress' },
      include: { submissions: true },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found or already submitted' });

    const submission = attempt.submissions.find((s) => s.questionId === questionId);
    if (!submission) return reply.status(404).send({ error: 'Question not in this attempt' });

    await prisma.submission.update({
      where: { id: submission.id },
      data: { code, language, status: 'pending' },
    });

    return reply.send({ message: 'Submitted. Code will be evaluated.', status: 'pending' });
  });

  app.post('/:id/submit-mcq', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const parsed = submitMcqSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { questionId, selectedOptionId } = parsed.data;

    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub, status: 'in_progress' },
      include: { submissions: true },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found or already submitted' });

    const submission = attempt.submissions.find((s) => s.questionId === questionId);
    if (!submission) return reply.status(404).send({ error: 'Question not in this attempt' });

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.type !== 'mcq') return reply.status(400).send({ error: 'Not an MCQ question' });

    const content = question.content as { options?: { id: string; isCorrect: boolean }[] };
    const options = content.options ?? [];
    const selected = options.find((o) => o.id === selectedOptionId);
    const correct = selected?.isCorrect ?? false;

    await prisma.submission.update({
      where: { id: submission.id },
      data: { selectedOptionId, status: correct ? 'passed' : 'failed', score: correct ? 1 : 0 },
    });

    return reply.send({ message: 'Submitted', status: correct ? 'passed' : 'failed', correct });
  });

  app.post('/:id/finish', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub, status: 'in_progress' },
      include: { submissions: true },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found or already submitted' });

    const totalScore = attempt.submissions.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const maxScore = attempt.submissions.length;

    await prisma.attempt.update({
      where: { id: request.params.id },
      data: { submittedAt: new Date(), score: totalScore, maxScore, status: 'submitted' },
    });

    return reply.send({ message: 'Attempt submitted', score: totalScore, maxScore });
  });
}
