import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createClientSchema, updateClientSchema } from '@enrich-skills/shared';
import {
  authenticate,
  requireModuleAccess,
  requireTenant,
  isSuperAdmin,
} from '../lib/tenant.js';
import { resolveClientScope, assertClientAccess } from '../lib/clientScope.js';
import { logRevision } from '../lib/revision.js';
import { sendAdminInviteEmail } from '../lib/email.js';
import { getTenantWebUrls } from '../lib/tenantUrls.js';

export async function clientRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'view');
    const prisma = await request.getTenantPrisma();
    const scope = await resolveClientScope(request, prisma);
    const { includeArchived } = request.query as { includeArchived?: string };

    const clients = await prisma.client.findMany({
      where: {
        tenantId,
        ...(scope.mode === 'client' ? { id: scope.clientId } : {}),
        ...(includeArchived === 'true' ? {} : { isArchived: false }),
      },
      include: {
        _count: { select: { members: true, batches: true, studentUsers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send(clients);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'view');
    const prisma = await request.getTenantPrisma();
    const scope = await resolveClientScope(request, prisma);

    const client = await prisma.client.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, role: true } } },
        },
        _count: { select: { batches: true, studentUsers: true } },
      },
    });
    if (!client) return reply.status(404).send({ error: 'Client not found' });
    assertClientAccess(scope, client.id);
    return reply.send(client);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'edit');
    const prisma = await request.getTenantPrisma();
    const scope = await resolveClientScope(request, prisma);
    if (scope.mode === 'client') {
      return reply.status(403).send({ error: 'Client-scoped admins cannot create new clients' });
    }
    const actor = request.user as { sub: string };
    const parsed = createClientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.client.findFirst({
      where: { tenantId, name: parsed.data.name },
    });
    if (existing) return reply.status(409).send({ error: 'A client with this name already exists' });

    const client = await prisma.client.create({
      data: { tenantId, name: parsed.data.name },
    });
    await logRevision(prisma, {
      tenantId,
      module: 'clients',
      entityId: client.id,
      action: 'created',
      userId: actor.sub,
      details: { name: client.name },
    });
    return reply.status(201).send(client);
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'edit');
    const prisma = await request.getTenantPrisma();
    const scope = await resolveClientScope(request, prisma);
    if (scope.mode === 'client') {
      return reply.status(403).send({ error: 'Client-scoped admins cannot modify clients' });
    }
    const actor = request.user as { sub: string };
    const parsed = updateClientSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.client.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Client not found' });

    if (existing.isGeneral && parsed.data.isArchived) {
      return reply.status(400).send({ error: 'The General client cannot be archived' });
    }
    if (existing.isGeneral && parsed.data.name && parsed.data.name !== existing.name) {
      return reply.status(400).send({ error: 'The General client cannot be renamed' });
    }

    if (parsed.data.name && parsed.data.name !== existing.name) {
      const dup = await prisma.client.findFirst({
        where: { tenantId, name: parsed.data.name, id: { not: existing.id } },
      });
      if (dup) return reply.status(409).send({ error: 'A client with this name already exists' });
    }

    const updated = await prisma.client.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.isArchived !== undefined ? { isArchived: parsed.data.isArchived } : {}),
      },
    });
    await logRevision(prisma, {
      tenantId,
      module: 'clients',
      entityId: updated.id,
      action: 'updated',
      userId: actor.sub,
      details: { name: updated.name, isArchived: updated.isArchived },
    });
    return reply.send(updated);
  });

  // Add an existing admin user as a member of this client
  app.post('/:id/members', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'edit');
    const prisma = await request.getTenantPrisma();
    const actor = request.user as { sub: string };

    const client = await prisma.client.findFirst({ where: { id: request.params.id, tenantId } });
    if (!client) return reply.status(404).send({ error: 'Client not found' });

    const body = request.body as { userId?: string };
    if (!body.userId) return reply.status(400).send({ error: 'userId is required' });

    const user = await prisma.user.findFirst({
      where: { id: body.userId, tenantId },
      select: { id: true, role: true, name: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role === 'student') {
      return reply.status(400).send({ error: 'Students are associated via their clientId field, not as client members' });
    }

    const member = await prisma.clientMember.upsert({
      where: { clientId_userId: { clientId: client.id, userId: body.userId } },
      update: {},
      create: { clientId: client.id, userId: body.userId },
    });

    await logRevision(prisma, {
      tenantId,
      module: 'clients',
      entityId: client.id,
      action: 'updated',
      userId: actor.sub,
      details: { action: 'member_added', memberName: user.name },
    });
    return reply.status(201).send(member);
  });

  // Invite a new admin user by email and add to client
  app.post('/:id/members/invite', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'edit');
    const prisma = await request.getTenantPrisma();
    const actor = request.user as { sub: string };

    const client = await prisma.client.findFirst({ where: { id: request.params.id, tenantId } });
    if (!client) return reply.status(404).send({ error: 'Client not found' });

    const body = request.body as { email?: string };
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return reply.status(400).send({ error: 'Email is required' });

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) return reply.status(409).send({ error: 'A user with this email already exists' });

    const tempPassword = randomUUID().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = await prisma.user.create({
      data: { tenantId, name: email.split('@')[0], email, passwordHash, role: 'invited', isActive: true },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });

    await prisma.clientMember.create({
      data: { clientId: client.id, userId: user.id },
    });

    await logRevision(prisma, {
      tenantId,
      module: 'clients',
      entityId: client.id,
      action: 'updated',
      userId: actor.sub,
      details: { action: 'member_invited', email },
    });

    try {
      const { adminUrl } = await getTenantWebUrls(tenantId);
      await sendAdminInviteEmail(email, tempPassword, adminUrl);
    } catch (err) {
      console.error('[invite-client-member] Email send failed:', err);
    }
    return reply.status(201).send(user);
  });

  // Remove a member from this client
  app.delete('/:id/members/:userId', async (request: FastifyRequest<{ Params: { id: string; userId: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'clients', 'edit');
    const prisma = await request.getTenantPrisma();
    const actor = request.user as { sub: string };

    const client = await prisma.client.findFirst({ where: { id: request.params.id, tenantId } });
    if (!client) return reply.status(404).send({ error: 'Client not found' });

    await prisma.clientMember.deleteMany({
      where: { clientId: client.id, userId: request.params.userId },
    });
    await logRevision(prisma, {
      tenantId,
      module: 'clients',
      entityId: client.id,
      action: 'updated',
      userId: actor.sub,
      details: { action: 'member_removed', removedUserId: request.params.userId },
    });
    return reply.status(204).send();
  });
}
