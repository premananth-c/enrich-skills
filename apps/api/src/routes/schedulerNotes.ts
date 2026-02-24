import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createSchedulerNoteSchema, updateSchedulerNoteSchema } from '@enrich-skills/shared';
import { requireTenant, requireAdmin, authenticate } from '../lib/tenant.js';

export async function schedulerNotesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/batches/:batchId/notes', async (request: FastifyRequest<{ Params: { batchId: string }; Querystring: { date: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const { date } = request.query;
    if (!date) return reply.status(400).send({ error: 'date (YYYY-MM-DD) is required' });
    const note = await prisma.schedulerNote.findUnique({
      where: {
        batchId_date: { batchId: request.params.batchId, date: new Date(date + 'T00:00:00.000Z') },
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    return reply.send(note ?? null);
  });

  app.put('/batches/:batchId/notes', async (request: FastifyRequest<{ Params: { batchId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const payload = request.user as { sub: string };
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const parsed = createSchedulerNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const date = new Date(parsed.data.date + 'T00:00:00.000Z');
    const note = await prisma.schedulerNote.upsert({
      where: {
        batchId_date: { batchId: request.params.batchId, date },
      },
      update: { content: parsed.data.content },
      create: {
        batchId: request.params.batchId,
        date,
        content: parsed.data.content,
        createdBy: payload.sub,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    return reply.send(note);
  });

  app.patch('/batches/:batchId/notes/:date', async (request: FastifyRequest<{ Params: { batchId: string; date: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const parsed = updateSchedulerNoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const date = new Date(request.params.date + 'T00:00:00.000Z');
    const note = await prisma.schedulerNote.update({
      where: { batchId_date: { batchId: request.params.batchId, date } },
      data: { content: parsed.data.content },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    return reply.send(note);
  });

  app.delete('/batches/:batchId/notes/:date', async (request: FastifyRequest<{ Params: { batchId: string; date: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const date = new Date(request.params.date + 'T00:00:00.000Z');
    await prisma.schedulerNote.deleteMany({
      where: { batchId: request.params.batchId, date },
    });
    return reply.status(204).send();
  });
}
