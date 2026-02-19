import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, authenticate } from '../lib/tenant.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const role = (request.query as { role?: string }).role;
    const users = await prisma.user.findMany({
      where: { tenantId, ...(role && { role }) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(users);
  });

  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const [students, tests, questions] = await Promise.all([
      prisma.user.count({ where: { tenantId, role: 'student' } }),
      prisma.test.count({ where: { tenantId } }),
      prisma.question.count({ where: { tenantId } }),
    ]);
    return reply.send({ students, tests, questions });
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        attempts: {
          include: { test: { select: { id: true, title: true, type: true } } },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send(user);
  });
}
