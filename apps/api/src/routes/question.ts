import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { createCodingQuestionSchema, createMcqQuestionSchema } from '@enrich-skills/shared';
import { requireTenant } from '../lib/tenant.js';

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

export async function questionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const type = (request.query as { type?: string }).type;
    const questions = await prisma.question.findMany({
      where: { tenantId, ...(type && { type }) },
      include: { testCases: { where: { isPublic: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(questions);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const question = await prisma.question.findFirst({
      where: { id: request.params.id, tenantId },
      include: { testCases: true },
    });
    if (!question) return reply.status(404).send({ error: 'Question not found' });
    return reply.send(question);
  });

  app.post('/coding', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const parsed = createCodingQuestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const question = await prisma.question.create({
      data: {
        tenantId,
        type: 'coding',
        content: {
          title: data.title,
          description: data.description,
          examples: data.examples,
          constraints: data.constraints,
        },
        difficulty: data.difficulty,
        tags: data.tags,
        testCases: {
          create: data.testCases.map((tc) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isPublic: tc.isPublic,
            weight: tc.weight,
          })),
        },
      },
      include: { testCases: true },
    });

    return reply.status(201).send(question);
  });

  app.post('/mcq', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const parsed = createMcqQuestionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const question = await prisma.question.create({
      data: {
        tenantId,
        type: 'mcq',
        content: {
          title: data.title,
          description: data.description,
          options: data.options.map((o) => ({
            id: randomUUID(),
            text: o.text,
            isCorrect: o.isCorrect,
          })),
          explanation: data.explanation,
        },
        difficulty: data.difficulty,
        tags: data.tags,
      },
    });

    return reply.status(201).send(question);
  });
}
