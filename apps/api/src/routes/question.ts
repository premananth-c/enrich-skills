import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { createCodingQuestionSchema, createMcqQuestionSchema, updateCodingQuestionSchema, updateMcqQuestionSchema } from '@enrich-skills/shared';
import { requireModuleAccess, authenticate } from '../lib/tenant.js';
import { logRevision } from '../lib/revision.js';

export async function questionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'view');
    const { type, includeArchived } = request.query as { type?: string; includeArchived?: string };
    const questions = await prisma.question.findMany({
      where: {
        tenantId,
        ...(type && { type }),
        ...(includeArchived === 'true' ? {} : { isArchived: false }),
      },
      include: { testCases: { where: { isPublic: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(questions);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'view');
    const question = await prisma.question.findFirst({
      where: { id: request.params.id, tenantId },
      include: { testCases: true },
    });
    if (!question) return reply.status(404).send({ error: 'Question not found' });
    return reply.send(question);
  });

  app.post('/coding', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'edit');
    const user = request.user as { sub: string };
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

    await logRevision({
      tenantId,
      module: 'questions',
      entityId: question.id,
      action: 'created',
      userId: user.sub,
      details: { title: (question.content as { title?: string })?.title ?? '(untitled)', type: question.type },
    });

    return reply.status(201).send(question);
  });

  app.post('/mcq', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'edit');
    const user = request.user as { sub: string };
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

    await logRevision({
      tenantId,
      module: 'questions',
      entityId: question.id,
      action: 'created',
      userId: user.sub,
      details: { title: (question.content as { title?: string })?.title ?? '(untitled)', type: question.type },
    });

    return reply.status(201).send(question);
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'edit');
    const user = request.user as { sub: string };
    const existing = await prisma.question.findFirst({
      where: { id: request.params.id, tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Question not found' });

    if (existing.type === 'coding') {
      const parsed = updateCodingQuestionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const data = parsed.data;
      const currentContent = existing.content as Record<string, unknown>;

      const question = await prisma.question.update({
        where: { id: request.params.id },
        data: {
          ...(data.difficulty && { difficulty: data.difficulty }),
          ...(data.tags && { tags: data.tags }),
          content: {
            ...currentContent,
            ...(data.title && { title: data.title }),
            ...(data.description && { description: data.description }),
            ...(data.examples !== undefined && { examples: data.examples }),
            ...(data.constraints !== undefined && { constraints: data.constraints }),
          },
          ...(data.testCases && {
            testCases: {
              deleteMany: {},
              create: data.testCases.map((tc) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isPublic: tc.isPublic,
                weight: tc.weight,
              })),
            },
          }),
        },
        include: { testCases: true },
      });
      await logRevision({
        tenantId,
        module: 'questions',
        entityId: question.id,
        action: 'updated',
        userId: user.sub,
        details: { title: (question.content as { title?: string })?.title ?? '(untitled)' },
      });
      return reply.send(question);
    } else {
      const parsed = updateMcqQuestionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const data = parsed.data;
      const currentContent = existing.content as Record<string, unknown>;

      const question = await prisma.question.update({
        where: { id: request.params.id },
        data: {
          ...(data.difficulty && { difficulty: data.difficulty }),
          ...(data.tags && { tags: data.tags }),
          content: {
            ...currentContent,
            ...(data.title && { title: data.title }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.options && {
              options: data.options.map((o) => ({
                id: randomUUID(),
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            }),
            ...(data.explanation !== undefined && { explanation: data.explanation }),
          },
        },
      });
      await logRevision({
        tenantId,
        module: 'questions',
        entityId: question.id,
        action: 'updated',
        userId: user.sub,
        details: { title: (question.content as { title?: string })?.title ?? '(untitled)' },
      });
      return reply.send(question);
    }
  });

  app.patch('/:id/archive', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'edit');
    const user = request.user as { sub: string };
    const existing = await prisma.question.findFirst({
      where: { id: request.params.id, tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Question not found' });
    const archived = await prisma.question.update({
      where: { id: request.params.id },
      data: { isArchived: true },
    });
    await logRevision({
      tenantId,
      module: 'questions',
      entityId: archived.id,
      action: 'archived',
      userId: user.sub,
      details: { title: (archived.content as { title?: string })?.title ?? '(untitled)' },
    });
    return reply.send(archived);
  });

  app.patch('/:id/revoke', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'questions', 'edit');
    const user = request.user as { sub: string };
    const existing = await prisma.question.findFirst({
      where: { id: request.params.id, tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Question not found' });
    const restored = await prisma.question.update({
      where: { id: request.params.id },
      data: { isArchived: false },
    });
    await logRevision({
      tenantId,
      module: 'questions',
      entityId: restored.id,
      action: 'updated',
      userId: user.sub,
      details: {
        title: (restored.content as { title?: string })?.title ?? '(untitled)',
        isArchived: false,
      },
    });
    return reply.send(restored);
  });
}
