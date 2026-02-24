import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createCourseAssignmentSchema } from '@enrich-skills/shared';
import { requireTenant, requireAdmin, authenticate } from '../lib/tenant.js';

export async function courseAssignmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const query = request.query as { courseId?: string; batchId?: string; userId?: string };
    const where: { tenantId: string; courseId?: string; batchId?: string; userId?: string } = { tenantId };
    if (query.courseId) where.courseId = query.courseId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.userId) where.userId = query.userId;
    const assignments = await prisma.courseAssignment.findMany({
      where,
      include: {
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return reply.send(assignments);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const payload = request.user as { sub: string };
    const parsed = createCourseAssignmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;
    if ((data.batchId != null) === (data.userId != null)) {
      return reply.status(400).send({ error: 'Exactly one of batchId or userId must be set' });
    }
    const course = await prisma.course.findFirst({ where: { id: data.courseId, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    if (data.batchId) {
      const batch = await prisma.batch.findFirst({ where: { id: data.batchId, tenantId } });
      if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    }
    if (data.userId) {
      const user = await prisma.user.findFirst({ where: { id: data.userId, tenantId } });
      if (!user) return reply.status(404).send({ error: 'User not found' });
    }
    const assignment = await prisma.courseAssignment.create({
      data: {
        tenantId,
        courseId: data.courseId,
        batchId: data.batchId ?? null,
        userId: data.userId ?? null,
        assignedBy: payload.sub,
        dueDate: data.dueDate ?? null,
      },
      include: {
        course: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return reply.status(201).send(assignment);
  });

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const existing = await prisma.courseAssignment.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Course assignment not found' });
    await prisma.courseAssignment.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
