import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import {
  MODULE_KEYS,
  authenticate,
  getResolvedPermissions,
  isSuperAdmin,
  requireModuleAccess,
  requireTenant,
  type ModuleKey,
  type PermissionLevel,
} from '../lib/tenant.js';
import { logRevision } from '../lib/revision.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/me/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const permissions = await getResolvedPermissions(request);
    const payload = request.user as { role?: string } | undefined;
    return reply.send({ tenantId, role: payload?.role ?? 'student', permissions, isSuperAdmin: isSuperAdmin(request) });
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'view');
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
    const tenantId = await requireModuleAccess(request, 'reports', 'view');
    const [students, tests, questions] = await Promise.all([
      prisma.user.count({ where: { tenantId, role: 'student' } }),
      prisma.test.count({ where: { tenantId } }),
      prisma.question.count({ where: { tenantId } }),
    ]);
    return reply.send({ students, tests, questions });
  });

  app.get('/roles', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: "You dont have permission to view this page." });
    }
    const tenantId = requireTenant(request);
    const roles = await prisma.roleDefinition.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(roles);
  });

  app.post('/roles', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: "You dont have permission to view this page." });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
    const body = request.body as {
      roleKey?: string;
      displayName?: string;
      permissions?: Partial<Record<ModuleKey, PermissionLevel>>;
    };
    const roleKey = (body.roleKey || '').trim().toLowerCase().replace(/\s+/g, '_');
    const displayName = (body.displayName || '').trim();
    if (!roleKey || !displayName) {
      return reply.status(400).send({ error: 'roleKey and displayName are required' });
    }
    if (roleKey === 'super_admin' || roleKey === 'admin' || roleKey === 'student') {
      return reply.status(400).send({ error: 'Reserved role key cannot be used' });
    }
    const permissions: Record<ModuleKey, PermissionLevel> = {
      courses: 'none',
      batches: 'none',
      tests: 'none',
      questions: 'none',
      students: 'none',
      reports: 'none',
      manage_users: 'none',
    };
    for (const key of MODULE_KEYS) {
      const val = body.permissions?.[key];
      if (val === 'view' || val === 'edit') permissions[key] = val;
    }
    const created = await prisma.roleDefinition.create({
      data: { tenantId, roleKey, displayName, permissions },
    });
    await logRevision({
      tenantId,
      module: 'students',
      entityId: created.id,
      action: 'created',
      userId: actor.sub,
      details: { roleKey: created.roleKey, displayName: created.displayName },
    });
    return reply.status(201).send(created);
  });

  app.patch('/roles/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: "You dont have permission to view this page." });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
    const body = request.body as {
      displayName?: string;
      permissions?: Partial<Record<ModuleKey, PermissionLevel>>;
      isActive?: boolean;
    };
    const existing = await prisma.roleDefinition.findFirst({
      where: { id: request.params.id, tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Role not found' });
    const permissions = (existing.permissions as Record<string, unknown>) || {};
    const nextPermissions: Record<ModuleKey, PermissionLevel> = {
      courses: 'none',
      batches: 'none',
      tests: 'none',
      questions: 'none',
      students: 'none',
      reports: 'none',
      manage_users: 'none',
    };
    for (const key of MODULE_KEYS) {
      const current = permissions[key];
      if (current === 'view' || current === 'edit') nextPermissions[key] = current;
      const incoming = body.permissions?.[key];
      if (incoming === 'view' || incoming === 'edit') nextPermissions[key] = incoming;
    }
    const updated = await prisma.roleDefinition.update({
      where: { id: request.params.id },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName.trim() || existing.displayName } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        permissions: nextPermissions,
      },
    });
    await logRevision({
      tenantId,
      module: 'students',
      entityId: updated.id,
      action: 'updated',
      userId: actor.sub,
      details: { roleKey: updated.roleKey, displayName: updated.displayName },
    });
    return reply.send(updated);
  });

  app.post('/admins', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: "You dont have permission to view this page." });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
    const body = request.body as { name?: string; email?: string; password?: string; role?: string; roleKey?: string };
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const role = (body.roleKey || body.role || 'admin').trim().toLowerCase();
    if (!name || !email || password.length < 8) {
      return reply.status(400).send({ error: 'name, email and password(min 8) are required' });
    }
    if (role !== 'admin' && role !== 'super_admin') {
      const roleDef = await prisma.roleDefinition.findFirst({ where: { tenantId, roleKey: role, isActive: true } });
      if (!roleDef) return reply.status(400).send({ error: 'Invalid custom role' });
    }
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) return reply.status(409).send({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { tenantId, name, email, passwordHash, role, isActive: true },
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: user.id,
      action: 'created',
      userId: actor.sub,
      details: { name: user.name, role: user.role },
    });
    return reply.status(201).send(user);
  });

  app.post('/students/direct', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: "You dont have permission to view this page." });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
    const body = request.body as {
      name?: string;
      email?: string;
      password?: string;
      phoneNumber?: string;
      address?: string;
    };
    const name = (body.name || '').trim();
    const password = body.password || '';
    const emailRaw = (body.email || '').trim().toLowerCase();
    if (!name || password.length < 8) {
      return reply.status(400).send({ error: 'name and password(min 8) are required' });
    }
    let email: string | null = null;
    if (emailRaw) {
      const existing = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: emailRaw } },
      });
      if (existing) return reply.status(409).send({ error: 'Email already registered' });
      email = emailRaw;
    } else {
      const offline = `offline_${Date.now()}_${Math.random().toString(16).slice(2, 8)}@offline.local`;
      email = offline;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const student = await prisma.user.create({
      data: {
        tenantId,
        name,
        email,
        passwordHash,
        role: 'student',
        phoneNumber: body.phoneNumber?.trim() || null,
        address: body.address?.trim() || null,
        isActive: true,
      },
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: student.id,
      action: 'created',
      userId: actor.sub,
      details: { name: student.name, email: student.email ?? null },
    });
    return reply.status(201).send(student);
  });

  app.patch('/:id/role', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: "You dont have permission to view this page." });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
    const body = request.body as { role?: string; roleKey?: string };
    const nextRole = (body.roleKey || body.role || '').trim().toLowerCase();
    if (!nextRole) return reply.status(400).send({ error: 'role is required' });
    if (nextRole !== 'admin' && nextRole !== 'super_admin' && nextRole !== 'student') {
      const roleDef = await prisma.roleDefinition.findFirst({
        where: { tenantId, roleKey: nextRole, isActive: true },
      });
      if (!roleDef) return reply.status(400).send({ error: 'Invalid custom role' });
    }
    const existing = await prisma.user.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'User not found' });
    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data: { role: nextRole },
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: updated.id,
      action: 'updated',
      userId: actor.sub,
      details: { role: updated.role, name: updated.name },
    });
    return reply.send(updated);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'view');
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
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const admin = request.user as { sub: string };
    const body = request.body as { name?: string; email?: string; phoneNumber?: string | null; address?: string | null; isActive?: boolean };
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role !== 'student') return reply.status(403).send({ error: 'Only students can be edited here' });
    const data: { name?: string; email?: string; phoneNumber?: string | null; address?: string | null; isActive?: boolean } = {};
    if (body.name !== undefined) data.name = body.name.trim() || '';
    if (body.email !== undefined) {
      const normalized = body.email.trim().toLowerCase();
      data.email = normalized || undefined;
    }
    if (body.phoneNumber !== undefined) data.phoneNumber = body.phoneNumber?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (data.email !== undefined) {
      const existing = await prisma.user.findFirst({
        where: { tenantId, email: data.email, id: { not: request.params.id } },
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: updated.id,
      action: 'updated',
      userId: admin.sub,
      details: { name: updated.name, email: updated.email, isActive: updated.isActive },
    });
    return reply.send(updated);
  });

  app.patch('/:id/archive', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const admin = request.user as { sub: string };
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role !== 'student') return reply.status(403).send({ error: 'Only students can be archived' });
    const archived = await prisma.user.update({
      where: { id: request.params.id },
      data: { isActive: false },
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: archived.id,
      action: 'archived',
      userId: admin.sub,
      details: { name: archived.name, email: archived.email },
    });
    return reply.send(archived);
  });

  app.patch('/:id/revoke', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const admin = request.user as { sub: string };
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role !== 'student') return reply.status(403).send({ error: 'Only students can be restored here' });
    const restored = await prisma.user.update({
      where: { id: request.params.id },
      data: { isActive: true },
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: restored.id,
      action: 'updated',
      userId: admin.sub,
      details: { name: restored.name, email: restored.email, isActive: restored.isActive },
    });
    return reply.send(restored);
  });
}
