import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireModuleAccess, authenticate } from '../lib/tenant.js';

type AttemptTestConfig = {
  attemptLimit?: number;
  passPercentage?: number;
};

function parseTestConfig(config: unknown): AttemptTestConfig {
  const c = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  return {
    attemptLimit: typeof c.attemptLimit === 'number' ? c.attemptLimit : 1,
    passPercentage: typeof c.passPercentage === 'number' ? c.passPercentage : 40,
  };
}

function computePassFail(
  score: number | null,
  maxScore: number | null,
  passPercentage: number
): 'passed' | 'failed' | null {
  if (score == null || maxScore == null || maxScore <= 0) return null;
  const pct = (Number(score) / Number(maxScore)) * 100;
  return pct >= passPercentage ? 'passed' : 'failed';
}

function assignAttemptNumbers<T extends { id: string; userId: string; testId: string; startedAt: Date }>(
  attempts: T[]
): Array<T & { attemptNumber: number }> {
  const sorted = [...attempts].sort((a, b) => {
    const t = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  const keyToNext = new Map<string, number>();
  const idToNumber = new Map<string, number>();
  for (const a of sorted) {
    const key = `${a.userId}\t${a.testId}`;
    const next = (keyToNext.get(key) ?? 0) + 1;
    keyToNext.set(key, next);
    idToNumber.set(a.id, next);
  }
  return attempts.map((a) => ({ ...a, attemptNumber: idToNumber.get(a.id) ?? 1 }));
}

type AttemptWithTestConfig = {
  id: string;
  userId: string;
  testId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  status: string;
  user?: { id: string; name: string; email: string | null };
  test: { id: string; title: string; config: unknown };
};

function serializeReportAttempts(attempts: AttemptWithTestConfig[]) {
  const numbered = assignAttemptNumbers(attempts);
  return numbered.map((a) => {
    const cfg = parseTestConfig(a.test.config);
    const maxAttempts = cfg.attemptLimit ?? 1;
    const passPct = cfg.passPercentage ?? 40;
    const result = computePassFail(a.score, a.maxScore, passPct);
    const base = {
      id: a.id,
      userId: a.userId,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      score: a.score,
      maxScore: a.maxScore,
      status: a.status,
      test: { id: a.test.id, title: a.test.title },
      attemptNumber: a.attemptNumber,
      maxAttempts,
      result,
    };
    if (a.user) {
      return { ...base, user: { id: a.user.id, name: a.user.name, email: a.user.email ?? '' } };
    }
    return base;
  });
}

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest<{ Querystring: { type: string; batchId?: string; testId?: string; userId?: string; q?: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'reports', 'view');
    const { type, batchId, testId, userId, q } = request.query;
    if (!type) return reply.status(400).send({ error: 'type is required: batch | test | student' });

    if (type === 'batch') {
      if (!batchId) return reply.status(400).send({ error: 'batchId is required for type=batch' });
      const batch = await prisma.batch.findFirst({
        where: { id: batchId, tenantId },
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
      if (!batch) return reply.status(404).send({ error: 'Batch not found' });
      const batchTestIds = (await prisma.batchTestAssignment.findMany({ where: { batchId }, select: { testId: true } })).map((x) => x.testId);
      const memberIds = batch.members.map((m) => m.user.id);
      const attemptsRaw = await prisma.attempt.findMany({
        where: { userId: { in: memberIds }, testId: batchTestIds.length ? { in: batchTestIds } : undefined },
        include: {
          user: { select: { id: true, name: true, email: true } },
          test: { select: { id: true, title: true, config: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
      return reply.send({ batch, attempts: serializeReportAttempts(attemptsRaw) });
    }

    if (type === 'test') {
      if (!testId) return reply.status(400).send({ error: 'testId is required for type=test' });
      const test = await prisma.test.findFirst({ where: { id: testId, tenantId }, select: { id: true, title: true } });
      if (!test) return reply.status(404).send({ error: 'Test not found' });
      const where: { testId: string; userId?: string | { in: string[] } } = { testId };
      if (batchId) {
        const memberIds = (await prisma.batchMember.findMany({ where: { batchId }, select: { userId: true } })).map((m) => m.userId);
        where.userId = { in: memberIds };
      }
      if (userId) where.userId = userId;
      const attemptsRaw = await prisma.attempt.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          test: { select: { id: true, title: true, config: true } },
        },
        orderBy: { startedAt: 'desc' },
      });
      const batches = await prisma.batch.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return reply.send({ test, attempts: serializeReportAttempts(attemptsRaw), batches });
    }

    if (type === 'student') {
      let targetUserId = userId;
      if (!targetUserId && q) {
        const users = await prisma.user.findMany({
          where: {
            tenantId,
            role: 'student',
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, name: true, email: true },
          take: 5,
        });
        if (users.length === 0) return reply.send({ search: true, users: [] });
        if (users.length === 1) targetUserId = users[0].id;
        else if (users.length > 1) return reply.send({ search: true, users, message: 'Multiple matches; specify userId' });
      }
      if (!targetUserId) return reply.status(400).send({ error: 'userId or q (search) is required for type=student' });
      const user = await prisma.user.findFirst({
        where: { id: targetUserId, tenantId },
        select: { id: true, name: true, email: true },
      });
      if (!user) return reply.status(404).send({ error: 'Student not found' });
      const [batches, courseAssignments, attempts] = await Promise.all([
        prisma.batchMember.findMany({
          where: { userId: targetUserId },
          include: { batch: { select: { id: true, name: true } } },
        }),
        prisma.courseAssignment.findMany({
          where: { userId: targetUserId },
          include: { course: { select: { id: true, title: true } }, batch: { select: { id: true, name: true } } },
        }),
        prisma.attempt.findMany({
          where: { userId: targetUserId },
          include: { test: { select: { id: true, title: true, config: true } } },
          orderBy: { startedAt: 'desc' },
        }),
      ]);
      return reply.send({
        user,
        batches,
        courseAssignments,
        attempts: serializeReportAttempts(
          attempts.map((a) => ({ ...a, user: { id: user.id, name: user.name, email: user.email } }))
        ),
      });
    }

    return reply.status(400).send({ error: 'type must be batch | test | student' });
  });
}
