import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createTestSchema, updateTestSchema } from '@enrich-skills/shared';
import { requireModuleAccess, authenticate } from '../lib/tenant.js';
import { logRevision } from '../lib/revision.js';

export async function testRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'view');
    const tests = await prisma.test.findMany({
      where: { tenantId },
      include: {
        testQuestions: { include: { question: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(tests);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'view');
    const test = await prisma.test.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        testQuestions: { include: { question: { include: { testCases: true } } }, orderBy: { order: 'asc' } },
        variants: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    return reply.send(test);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const user = request.user as { sub: string };
    const parsed = createTestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const test = await prisma.test.create({
      data: {
        tenantId,
        title: data.title,
        type: data.type,
        difficulty: data.difficulty ?? null,
        config: data.config as object,
        schedule: data.schedule as object ?? undefined,
        testQuestions: data.questionIds?.length
          ? {
              create: data.questionIds.map((qId, i) => ({ questionId: qId, order: i })),
            }
          : undefined,
      },
      include: { testQuestions: true },
    });

    await logRevision({
      tenantId,
      module: 'tests',
      entityId: test.id,
      action: 'created',
      userId: user.sub,
      details: { title: test.title, type: test.type },
    });

    return reply.status(201).send(test);
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const user = request.user as { sub: string };
    const parsed = updateTestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const existing = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Test not found' });

    const test = await prisma.test.update({
      where: { id: request.params.id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.type && { type: data.type }),
        ...(data.status && { status: data.status }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty ?? null }),
        ...(data.config && { config: data.config as object }),
        ...(data.schedule !== undefined && { schedule: data.schedule as object }),
        ...(data.questionIds && {
          testQuestions: {
            deleteMany: {},
            create: data.questionIds.map((qId, i) => ({ questionId: qId, order: i })),
          },
        }),
      },
      include: { testQuestions: true },
    });

    await logRevision({
      tenantId,
      module: 'tests',
      entityId: test.id,
      action: data.status === 'archived' ? 'archived' : 'updated',
      userId: user.sub,
      details: { title: test.title, status: test.status },
    });

    return reply.send(test);
  });

  app.patch('/:id/revoke', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const user = request.user as { sub: string };
    const existing = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Test not found' });

    const test = await prisma.test.update({
      where: { id: request.params.id },
      data: { status: 'draft' },
      include: { testQuestions: true },
    });

    await logRevision({
      tenantId,
      module: 'tests',
      entityId: test.id,
      action: 'updated',
      userId: user.sub,
      details: { title: test.title, status: test.status },
    });

    return reply.send(test);
  });

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const { deleteQuestions } = request.query as { deleteQuestions?: string };
    const existing = await prisma.test.findFirst({
      where: { id: request.params.id, tenantId },
      include: { testQuestions: { select: { questionId: true } } },
    });
    if (!existing) return reply.status(404).send({ error: 'Test not found' });
    if (existing.status !== 'archived') {
      return reply.status(400).send({ error: 'Only archived tests can be permanently deleted. Archive the test first.' });
    }

    const questionIds = existing.testQuestions.map((tq) => tq.questionId);

    await prisma.test.delete({ where: { id: request.params.id } });

    if (deleteQuestions === 'true' && questionIds.length > 0) {
      const stillLinked = await prisma.testQuestion.findMany({
        where: { questionId: { in: questionIds } },
        select: { questionId: true },
      });
      const stillLinkedIds = new Set(stillLinked.map((tq) => tq.questionId));
      const toDelete = questionIds.filter((qid) => !stillLinkedIds.has(qid));
      if (toDelete.length > 0) {
        await prisma.question.deleteMany({ where: { id: { in: toDelete }, tenantId } });
      }
    }

    return reply.status(204).send();
  });

  app.get('/:id/attempts', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'view');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });

    const allocations = await prisma.testAllocation.findMany({
      where: { testId: request.params.id },
      orderBy: { assignedAt: 'desc' },
    });
    const userIds = [...new Set(allocations.map((a) => a.userId))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const attempts = await prisma.attempt.findMany({
      where: { testId: request.params.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        submissions: { select: { id: true, questionId: true, status: true, score: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const attemptsByUser = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const list = attemptsByUser.get(attempt.userId) ?? [];
      list.push(attempt);
      attemptsByUser.set(attempt.userId, list);
    }

    const students = allocations.map((allocation) => {
      const attemptsForUser = attemptsByUser.get(allocation.userId) ?? [];
      const latestAttempt = attemptsForUser[0];
      return {
        userId: allocation.userId,
        user: userMap.get(allocation.userId) ?? null,
        assignedAt: allocation.assignedAt,
        variantId: allocation.variantId,
        attemptCount: attemptsForUser.length,
        latestStatus: latestAttempt?.status ?? 'not_started',
        latestScore: latestAttempt?.score ?? null,
        latestMaxScore: latestAttempt?.maxScore ?? null,
        attempts: attemptsForUser,
      };
    });

    return reply.send({ students, attempts });
  });

  // --- Variant CRUD ---

  app.get('/:id/variants', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'view');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    const variants = await prisma.testVariant.findMany({
      where: { testId: request.params.id },
      include: {
        testQuestions: { include: { question: true }, orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(variants);
  });

  app.post('/:id/variants', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });

    const body = request.body as { name: string; difficulty: string; questionIds?: string[] };
    if (!body.name || !body.difficulty) {
      return reply.status(400).send({ error: 'name and difficulty are required' });
    }

    const variant = await prisma.testVariant.create({
      data: {
        testId: request.params.id,
        name: body.name,
        difficulty: body.difficulty,
      },
    });

    if (body.questionIds?.length) {
      await prisma.testQuestion.updateMany({
        where: {
          testId: request.params.id,
          questionId: { in: body.questionIds },
        },
        data: { variantId: variant.id },
      });
    }

    return reply.status(201).send(variant);
  });

  app.patch('/:id/variants/:variantId', async (request: FastifyRequest<{ Params: { id: string; variantId: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });

    const body = request.body as { name?: string; difficulty?: string; questionIds?: string[] };

    const variant = await prisma.testVariant.update({
      where: { id: request.params.variantId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.difficulty && { difficulty: body.difficulty }),
      },
    });

    if (body.questionIds) {
      await prisma.testQuestion.updateMany({
        where: { testId: request.params.id, variantId: request.params.variantId },
        data: { variantId: null },
      });
      if (body.questionIds.length > 0) {
        await prisma.testQuestion.updateMany({
          where: {
            testId: request.params.id,
            questionId: { in: body.questionIds },
          },
          data: { variantId: variant.id },
        });
      }
    }

    return reply.send(variant);
  });

  app.delete('/:id/variants/:variantId', async (request: FastifyRequest<{ Params: { id: string; variantId: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });

    await prisma.testQuestion.updateMany({
      where: { variantId: request.params.variantId },
      data: { variantId: null },
    });
    await prisma.testVariant.delete({ where: { id: request.params.variantId } });
    return reply.status(204).send();
  });

  // --- Test Allocation (assign test to student with optional variant) ---

  app.get('/:id/allocations', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'view');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });

    const allocations = await prisma.testAllocation.findMany({
      where: { testId: request.params.id },
      include: { variant: true },
      orderBy: { assignedAt: 'desc' },
    });
    return reply.send(allocations);
  });

  app.post('/:id/allocations', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const admin = request.user as { sub: string };
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    if (test.status !== 'published') {
      return reply.status(403).send({ error: 'Only published tests can be assigned to students. Set the test status to Published first.' });
    }

    const body = request.body as { userId?: string; email?: string; variantId?: string; resetAttempts?: boolean };
    let userId = body.userId;

    if (!userId && body.email) {
      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: body.email.toLowerCase().trim() } },
      });
      if (user) {
        userId = user.id;
      } else {
        const { sendInviteEmail } = await import('../lib/email.js');
        const { randomUUID } = await import('crypto');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 2);
        const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);
        await prisma.invite.create({
          data: {
            tenantId,
            email: body.email.toLowerCase().trim(),
            token,
            expiresAt,
            invitedBy: admin.sub,
            testId: request.params.id,
            variantId: body.variantId ?? undefined,
          },
        });
        await sendInviteEmail(body.email, token, { testTitle: test.title });
        return reply.status(201).send({ inviteSent: true, email: body.email, message: 'Student not registered. Invite sent to email.' });
      }
    }

    if (!userId) {
      return reply.status(400).send({ error: 'userId or email is required' });
    }

    const allocation = await prisma.testAllocation.upsert({
      where: { userId_testId: { userId, testId: request.params.id } },
      update: { variantId: body.variantId ?? null, assignedBy: admin.sub },
      create: {
        userId,
        testId: request.params.id,
        variantId: body.variantId ?? null,
        assignedBy: admin.sub,
      },
    });

    if (body.resetAttempts) {
      await prisma.attempt.deleteMany({
        where: { userId, testId: request.params.id },
      });
    }
    return reply.status(201).send(allocation);
  });

  app.delete('/:id/allocations/:userId', async (request: FastifyRequest<{ Params: { id: string; userId: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'tests', 'edit');
    const test = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    await prisma.testAllocation.deleteMany({
      where: { testId: request.params.id, userId: request.params.userId },
    });
    return reply.status(204).send();
  });
}
