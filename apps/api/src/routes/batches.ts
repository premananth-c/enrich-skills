import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createBatchSchema, updateBatchSchema, addBatchMemberSchema } from '@enrich-skills/shared';
import { requireModuleAccess, authenticate } from '../lib/tenant.js';
import { logRevision } from '../lib/revision.js';

export async function batchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'view');
    const { includeArchived } = request.query as { includeArchived?: string };
    const batches = await prisma.batch.findMany({
      where: { tenantId, ...(includeArchived === 'true' ? {} : { isArchived: false }) },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(batches);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'view');
    const batch = await prisma.batch.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    return reply.send(batch);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const user = request.user as { sub: string };
    const parsed = createBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const batch = await prisma.batch.create({
      data: {
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    await logRevision({
      tenantId,
      module: 'batches',
      entityId: batch.id,
      action: 'created',
      userId: user.sub,
      details: { name: batch.name },
    });
    return reply.status(201).send(batch);
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const user = request.user as { sub: string };
    const parsed = updateBatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Batch not found' });
    const batch = await prisma.batch.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description ?? null }),
      },
    });
    await logRevision({
      tenantId,
      module: 'batches',
      entityId: batch.id,
      action: 'updated',
      userId: user.sub,
      details: { name: batch.name },
    });
    return reply.send(batch);
  });

  app.patch('/:id/archive', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const user = request.user as { sub: string };
    const existing = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Batch not found' });
    const archived = await prisma.batch.update({
      where: { id: request.params.id },
      data: { isArchived: true },
    });
    await logRevision({
      tenantId,
      module: 'batches',
      entityId: archived.id,
      action: 'archived',
      userId: user.sub,
      details: { name: archived.name },
    });
    return reply.send(archived);
  });

  app.patch('/:id/revoke', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const user = request.user as { sub: string };
    const existing = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Batch not found' });
    const restored = await prisma.batch.update({
      where: { id: request.params.id },
      data: { isArchived: false },
    });
    await logRevision({
      tenantId,
      module: 'batches',
      entityId: restored.id,
      action: 'updated',
      userId: user.sub,
      details: { name: restored.name, isArchived: false },
    });
    return reply.send(restored);
  });

  // --- Members ---
  app.get('/:id/members', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'view');
    const batch = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const members = await prisma.batchMember.findMany({
      where: { batchId: request.params.id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return reply.send(members);
  });

  app.post('/:id/members', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const admin = request.user as { sub: string };
    const batch = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const parsed = addBatchMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const user = await prisma.user.findFirst({ where: { id: parsed.data.userId, tenantId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const member = await prisma.batchMember.upsert({
      where: { batchId_userId: { batchId: request.params.id, userId: parsed.data.userId } },
      update: {},
      create: { batchId: request.params.id, userId: parsed.data.userId },
    });
    const batchTests = await prisma.batchTestAssignment.findMany({
      where: { batchId: request.params.id },
      select: { testId: true },
    });
    for (const bt of batchTests) {
      await prisma.testAllocation.upsert({
        where: { userId_testId: { userId: parsed.data.userId, testId: bt.testId } },
        update: {},
        create: { userId: parsed.data.userId, testId: bt.testId, assignedBy: admin.sub },
      });
    }
    return reply.status(201).send(member);
  });

  app.delete('/:id/members/:userId', async (request: FastifyRequest<{ Params: { id: string; userId: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const batch = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    await prisma.batchMember.deleteMany({
      where: { batchId: request.params.id, userId: request.params.userId },
    });
    return reply.status(204).send();
  });

  // --- Batch tests (assign tests from test bank to batch) ---
  app.get('/:id/tests', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'view');
    const batch = await prisma.batch.findFirst({ where: { id: request.params.id, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const assignments = await prisma.batchTestAssignment.findMany({
      where: { batchId: request.params.id },
      include: { test: { select: { id: true, title: true, type: true, status: true } } },
      orderBy: { assignedAt: 'desc' },
    });
    return reply.send(assignments);
  });

  app.post('/:id/tests', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const admin = request.user as { sub: string };
    const batch = await prisma.batch.findFirst({
      where: { id: request.params.id, tenantId },
      include: { members: { select: { userId: true } } },
    });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const body = request.body as { testId: string };
    if (!body.testId) return reply.status(400).send({ error: 'testId is required' });
    const test = await prisma.test.findFirst({ where: { id: body.testId, tenantId } });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    const existing = await prisma.batchTestAssignment.findUnique({
      where: { batchId_testId: { batchId: request.params.id, testId: body.testId } },
    });
    if (existing) return reply.status(400).send({ error: 'Test already assigned to this batch' });
    await prisma.batchTestAssignment.create({
      data: { batchId: request.params.id, testId: body.testId, assignedBy: admin.sub },
    });
    for (const m of batch.members) {
      await prisma.testAllocation.upsert({
        where: { userId_testId: { userId: m.userId, testId: body.testId } },
        update: {},
        create: { userId: m.userId, testId: body.testId, assignedBy: admin.sub },
      });
    }
    const assignments = await prisma.batchTestAssignment.findMany({
      where: { batchId: request.params.id },
      include: { test: { select: { id: true, title: true, type: true, status: true } } },
      orderBy: { assignedAt: 'desc' },
    });
    return reply.status(201).send(assignments);
  });

  app.delete('/:id/tests/:testId', async (request: FastifyRequest<{ Params: { id: string; testId: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'batches', 'edit');
    const batch = await prisma.batch.findFirst({
      where: { id: request.params.id, tenantId },
      include: { members: { select: { userId: true } } },
    });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    await prisma.batchTestAssignment.deleteMany({
      where: { batchId: request.params.id, testId: request.params.testId },
    });
    for (const m of batch.members) {
      await prisma.testAllocation.deleteMany({
        where: { userId: m.userId, testId: request.params.testId },
      });
    }
    return reply.status(204).send();
  });
}
