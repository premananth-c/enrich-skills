import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { submitCodeSchema, submitMcqSchema } from '@enrich-skills/shared';
import { requireTenant, authenticate } from '../lib/tenant.js';

type AttemptTestConfig = {
  attemptLimit?: number;
  showResultsImmediately?: boolean;
  passPercentage?: number;
  scoreDistribution?: 'equal' | 'custom';
  questionWeights?: Record<string, number>;
};

function getQuestionWeight(config: AttemptTestConfig, questionId: string): number {
  if (config.scoreDistribution === 'custom' && config.questionWeights && Number.isFinite(config.questionWeights[questionId])) {
    return Math.max(0, Number(config.questionWeights[questionId]));
  }
  return 1;
}

function computeAttemptResult(
  submissions: Array<{ questionId: string; score: number | null }>,
  config: AttemptTestConfig
) {
  const maxScore = submissions.reduce((sum, s) => sum + getQuestionWeight(config, s.questionId), 0);
  const totalScore = submissions.reduce(
    (sum, s) =>
      sum +
      Math.max(
        0,
        Math.min(getQuestionWeight(config, s.questionId), Number.isFinite(s.score as number) ? Number(s.score) : 0)
      ),
    0
  );
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const passPercentage = config.passPercentage ?? 40;
  return {
    totalScore,
    maxScore,
    percentage,
    passPercentage,
    result: percentage >= passPercentage ? 'pass' : 'fail',
  };
}

function stripCorrectAnswers(attempt: Record<string, unknown>) {
  const test = attempt.test as Record<string, unknown> | undefined;
  if (!test?.testQuestions) return attempt;
  const tqs = test.testQuestions as { question: { content: Record<string, unknown> } }[];
  return {
    ...attempt,
    test: {
      ...test,
      testQuestions: tqs.map((tq) => {
        const content = tq.question.content;
        if (content?.options && Array.isArray(content.options)) {
          return {
            ...tq,
            question: {
              ...tq.question,
              content: {
                ...content,
                options: (content.options as { id: string; text: string }[]).map(({ id, text }) => ({ id, text })),
              },
            },
          };
        }
        return tq;
      }),
    },
  };
}

export async function attemptRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempts = await prisma.attempt.findMany({
      where: { userId: user.sub },
      include: { test: { select: { title: true, config: true } } },
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

    const allocation = await prisma.testAllocation.findUnique({
      where: { userId_testId: { userId: user.sub, testId: body.testId } },
    });
    if (!allocation) return reply.status(403).send({ error: 'Test is not assigned to you' });

    const test = await prisma.test.findFirst({
      where: { id: body.testId, tenantId: user.tenantId },
      include: { testQuestions: { include: { question: true }, orderBy: { order: 'asc' } } },
    });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    if (test.status !== 'published') {
      return reply.status(403).send({ error: 'Test is not published yet' });
    }

    const schedule = test.schedule as { startAt?: string; endAt?: string } | null;
    if (schedule?.startAt && new Date(schedule.startAt).getTime() > Date.now()) {
      return reply.status(403).send({ error: 'Test has not started yet' });
    }
    if (schedule?.endAt && new Date(schedule.endAt).getTime() < Date.now()) {
      return reply.status(403).send({ error: 'Test submission window is closed' });
    }

    const config = test.config as AttemptTestConfig;
    const existingCount = await prisma.attempt.count({
      where: { userId: user.sub, testId: body.testId },
    });
    if (config.attemptLimit && existingCount >= config.attemptLimit) {
      return reply.status(403).send({ error: 'Attempt limit reached' });
    }

    const inProgress = await prisma.attempt.findFirst({
      where: { userId: user.sub, testId: body.testId, status: 'in_progress' },
      include: {
        test: {
          include: {
            testQuestions: {
              include: { question: { include: { testCases: { where: { isPublic: true } } } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        submissions: true,
      },
    });
    if (inProgress) {
      return reply.send(stripCorrectAnswers(inProgress as unknown as Record<string, unknown>));
    }

    const selectedQuestions = allocation.variantId
      ? test.testQuestions.filter((tq) => tq.variantId === allocation.variantId)
      : test.testQuestions;
    const questionsForAttempt = selectedQuestions.length > 0 ? selectedQuestions : test.testQuestions;

    const attempt = await prisma.attempt.create({
      data: {
        userId: user.sub,
        testId: body.testId,
        variantId: allocation.variantId ?? null,
        status: 'in_progress',
        submissions: {
          create: questionsForAttempt.map((tq) => ({
            questionId: tq.questionId,
            status: 'pending',
          })),
        },
      },
      include: {
        test: {
          include: {
            testQuestions: {
              include: { question: { include: { testCases: { where: { isPublic: true } } } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        submissions: true,
      },
    });

    return reply.status(201).send(stripCorrectAnswers(attempt as unknown as Record<string, unknown>));
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub },
      include: {
        test: {
          include: {
            testQuestions: {
              include: { question: { include: { testCases: { where: { isPublic: true } } } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        submissions: { include: { question: true } },
      },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found' });
    return reply.send(stripCorrectAnswers(attempt as unknown as Record<string, unknown>));
  });

  // GET /:id/review — full attempt with correct answers for post-submit review
  app.get('/:id/review', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub },
      include: {
        test: {
          include: {
            testQuestions: {
              include: { question: { include: { testCases: { where: { isPublic: true } } } } },
              orderBy: { order: 'asc' },
            },
          },
        },
        submissions: { include: { question: true } },
      },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found' });
    if (attempt.status === 'in_progress') {
      return reply.status(400).send({ error: 'Submit the test first to review answers' });
    }
    return reply.send(attempt);
  });

  // GET /:id/result — returns full attempt result when available
  app.get('/:id/result', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub },
      include: {
        test: {
          select: { id: true, title: true, type: true, config: true },
        },
        submissions: {
          include: { question: { select: { id: true, type: true, content: true } } },
        },
      },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found' });

    if (attempt.status === 'in_progress') {
      return reply.status(400).send({ error: 'Attempt is still in progress' });
    }

    const config = attempt.test.config as AttemptTestConfig;
    if (!config.showResultsImmediately && attempt.status !== 'graded') {
      return reply.send({
        id: attempt.id,
        status: attempt.status,
        resultsAvailable: false,
        message: 'Results will be shared by your instructor.',
      });
    }

    const result = computeAttemptResult(
      attempt.submissions.map((s) => ({ questionId: s.questionId, score: s.score ?? 0 })),
      config
    );

    return reply.send({
      ...attempt,
      resultsAvailable: true,
      result: result.result,
      passPercentage: result.passPercentage,
      percentage: result.percentage,
    });
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
      include: { submissions: true, test: { select: { config: true } } },
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

    const config = attempt.test.config as AttemptTestConfig;
    const weight = getQuestionWeight(config, questionId);

    const updatedSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: { selectedOptionId, status: correct ? 'passed' : 'failed', score: correct ? weight : 0 },
    });

    return reply.send({
      message: 'Submitted',
      status: correct ? 'passed' : 'failed',
      correct,
      score: updatedSubmission.score ?? 0,
      submittedAt: updatedSubmission.updatedAt,
    });
  });

  app.post('/:id/finish', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = request.user as { sub: string };
    const attempt = await prisma.attempt.findFirst({
      where: { id: request.params.id, userId: user.sub, status: 'in_progress' },
      include: { submissions: true, test: { select: { config: true } } },
    });
    if (!attempt) return reply.status(404).send({ error: 'Attempt not found or already submitted' });

    const config = attempt.test.config as AttemptTestConfig;
    const result = computeAttemptResult(
      attempt.submissions.map((s) => ({ questionId: s.questionId, score: s.score ?? 0 })),
      config
    );
    const submittedAt = new Date();

    await prisma.attempt.update({
      where: { id: request.params.id },
      data: { submittedAt, score: result.totalScore, maxScore: result.maxScore, status: 'submitted' },
    });

    if (config.showResultsImmediately) {
      return reply.send({
        message: 'Attempt submitted',
        score: result.totalScore,
        maxScore: result.maxScore,
        percentage: result.percentage,
        result: result.result,
        passPercentage: result.passPercentage,
        submittedAt,
        resultsAvailable: true,
      });
    }

    return reply.send({
      message: 'Attempt submitted. Results will be shared by your instructor.',
      score: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      result: result.result,
      passPercentage: result.passPercentage,
      submittedAt,
      resultsAvailable: false,
    });
  });
}
