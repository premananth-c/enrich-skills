import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createTestSchema, updateTestSchema } from '@enrich-skills/shared';
import { requireTenant } from '../lib/tenant.js';

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function testRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
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
    const tenantId = requireTenant(request);
    const test = await prisma.test.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        testQuestions: { include: { question: { include: { testCases: true } } }, orderBy: { order: 'asc' } },
      },
    });
    if (!test) return reply.status(404).send({ error: 'Test not found' });
    return reply.send(test);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
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

    return reply.status(201).send(test);
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
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

    return reply.send(test);
  });

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const existing = await prisma.test.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Test not found' });
    await prisma.test.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
