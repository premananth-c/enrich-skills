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
        phoneNumber: true,
        address: true,
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
        phoneNumber: true,
        address: true,
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

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const body = request.body as { name?: string; email?: string; phoneNumber?: string | null; address?: string | null; isActive?: boolean };
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role !== 'student') return reply.status(403).send({ error: 'Only students can be edited here' });
    if (body.email !== undefined && !body.email.trim()) return reply.status(400).send({ error: 'Email is required' });
    const data: { name?: string; email?: string; phoneNumber?: string | null; address?: string | null; isActive?: boolean } = {};
    if (body.name !== undefined) data.name = body.name.trim() || '';
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    if (body.phoneNumber !== undefined) data.phoneNumber = body.phoneNumber?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { tenantId, email: data.email!, id: { not: request.params.id } },
      });
      if (existing) return reply.status(409).send({ error: 'Another user with this email already exists' });
    }
    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phoneNumber: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return reply.send(updated);
  });

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role !== 'student') return reply.status(403).send({ error: 'Only students can be deleted' });
    await prisma.user.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
}
