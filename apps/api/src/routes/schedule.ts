import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createScheduleEventSchema, updateScheduleEventSchema } from '@enrich-skills/shared';
import { requireTenant, requireAdmin, authenticate } from '../lib/tenant.js';

export async function scheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/batches/:batchId/events', async (request: FastifyRequest<{ Params: { batchId: string }; Querystring: { from?: string; to?: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const { from, to } = request.query;
    const where: { batchId: string; startAt?: { gte?: Date; lte?: Date } } = { batchId: request.params.batchId };
    if (from) where.startAt = { ...where.startAt, gte: new Date(from) };
    if (to) where.startAt = { ...where.startAt, lte: new Date(to) };
    const events = await prisma.batchScheduleEvent.findMany({
      where,
      include: { course: { select: { id: true, title: true } } },
      orderBy: { startAt: 'asc' },
    });
    return reply.send(events);
  });

  app.post('/batches/:batchId/events', async (request: FastifyRequest<{ Params: { batchId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const parsed = createScheduleEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const event = await prisma.batchScheduleEvent.create({
      data: {
        batchId: request.params.batchId,
        title: parsed.data.title,
        startAt: parsed.data.startAt,
        endAt: parsed.data.endAt,
        type: parsed.data.type ?? null,
        courseId: parsed.data.courseId ?? null,
        location: parsed.data.location ?? null,
        metadata: (parsed.data.metadata as object) ?? {},
      },
      include: { course: { select: { id: true, title: true } } },
    });
    return reply.status(201).send(event);
  });

  app.patch('/batches/:batchId/events/:eventId', async (request: FastifyRequest<{ Params: { batchId: string; eventId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const parsed = updateScheduleEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const event = await prisma.batchScheduleEvent.update({
      where: { id: request.params.eventId },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.startAt && { startAt: parsed.data.startAt }),
        ...(parsed.data.endAt && { endAt: parsed.data.endAt }),
        ...(parsed.data.type !== undefined && { type: parsed.data.type ?? null }),
        ...(parsed.data.courseId !== undefined && { courseId: parsed.data.courseId ?? null }),
        ...(parsed.data.location !== undefined && { location: parsed.data.location ?? null }),
        ...(parsed.data.metadata && { metadata: parsed.data.metadata as object }),
      },
      include: { course: { select: { id: true, title: true } } },
    });
    return reply.send(event);
  });

  app.delete('/batches/:batchId/events/:eventId', async (request: FastifyRequest<{ Params: { batchId: string; eventId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    await prisma.batchScheduleEvent.deleteMany({
      where: { id: request.params.eventId, batchId: request.params.batchId },
    });
    return reply.status(204).send();
  });
}
