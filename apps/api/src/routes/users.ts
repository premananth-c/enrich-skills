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
import { randomUUID } from 'crypto';
import { sendAdminInviteEmail } from '../lib/email.js';

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.patch('/me/password', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { sub: string };
    const body = request.body as { currentPassword?: string; newPassword?: string };
    const currentPassword = (body.currentPassword || '').trim();
    const newPassword = (body.newPassword || '').trim();
    if (!currentPassword || newPassword.length < 8) {
      return reply.status(400).send({ error: 'Current password and new password (min 8 chars) are required' });
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return reply.status(400).send({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: payload.sub }, data: { passwordHash } });
    return reply.send({ message: 'Password changed successfully' });
  });

  app.patch('/:id/password', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: 'Only super admins can change passwords for other users' });
    }
    const tenantId = requireTenant(request);
    const body = request.body as { newPassword?: string };
    const newPassword = (body.newPassword || '').trim();
    if (newPassword.length < 8) {
      return reply.status(400).send({ error: 'New password (min 8 chars) is required' });
    }
    const user = await prisma.user.findFirst({ where: { id: request.params.id, tenantId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role === 'super_admin') {
      return reply.status(403).send({ error: 'Cannot reset password for another super admin' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: request.params.id }, data: { passwordHash } });
    const actor = request.user as { sub: string };
    await logRevision({
      tenantId,
      module: 'students',
      entityId: user.id,
      action: 'updated',
      userId: actor.sub,
      details: { action: 'password_reset', name: user.name },
    });
    return reply.send({ message: 'Password changed successfully' });
  });

  app.patch('/:id/email', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: 'Only super admins can change emails for other users' });
    }
    const tenantId = requireTenant(request);
    const body = request.body as { email?: string };
    const email = (body.email || '').trim().toLowerCase();
    if (!email) return reply.status(400).send({ error: 'Email is required' });
    const user = await prisma.user.findFirst({ where: { id: request.params.id, tenantId } });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const existing = await prisma.user.findFirst({
      where: { tenantId, email, id: { not: request.params.id } },
    });
    if (existing) return reply.status(409).send({ error: 'Another user with this email already exists' });
    const updated = await prisma.user.update({
      where: { id: request.params.id },
      data: { email },
      select: { id: true, email: true, name: true, role: true },
    });
    const actor = request.user as { sub: string };
    await logRevision({
      tenantId,
      module: 'students',
      entityId: updated.id,
      action: 'updated',
      userId: actor.sub,
      details: { action: 'email_changed', name: updated.name, email: updated.email },
    });
    return reply.send(updated);
  });

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
    const displayName = (body.displayName || '').trim();
    if (!displayName) {
      return reply.status(400).send({ error: 'displayName is required' });
    }
    const rawKey = (body.roleKey || displayName).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const baseKey = rawKey || 'role';
    let roleKey = baseKey;
    let suffix = 0;
    while (true) {
      if (roleKey !== 'super_admin' && roleKey !== 'admin' && roleKey !== 'student' && roleKey !== 'invited') {
        const exists = await prisma.roleDefinition.findFirst({
          where: { tenantId, roleKey, isActive: true },
        });
        if (!exists) break;
      }
      suffix += 1;
      roleKey = `${baseKey}_${suffix}`;
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

  app.post('/admins/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: 'Only super admins can invite admin users' });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
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
    await logRevision({
      tenantId,
      module: 'students',
      entityId: user.id,
      action: 'created',
      userId: actor.sub,
      details: { name: user.name, role: user.role, method: 'invite' },
    });
    try {
      await sendAdminInviteEmail(email, tempPassword);
    } catch (err) {
      console.error('[invite-admin] Email send failed:', err);
    }
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
    if (nextRole !== 'admin' && nextRole !== 'super_admin' && nextRole !== 'student' && nextRole !== 'invited') {
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

  app.delete('/admins/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isSuperAdmin(request)) {
      return reply.status(403).send({ error: 'Only super admins can delete admin users' });
    }
    const tenantId = requireTenant(request);
    const actor = request.user as { sub: string };
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role === 'super_admin') {
      return reply.status(403).send({ error: 'Cannot delete a super admin user' });
    }
    if (user.role === 'student') {
      return reply.status(400).send({ error: 'Use the student delete endpoint instead' });
    }
    if (user.id === actor.sub) {
      return reply.status(400).send({ error: 'Cannot delete your own account' });
    }

    await prisma.$transaction([
      prisma.testAllocation.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    await logRevision({
      tenantId,
      module: 'students',
      entityId: user.id,
      action: 'deleted',
      userId: actor.sub,
      details: { name: user.name, email: user.email, role: user.role },
    });
    return reply.send({ message: `Admin user "${user.name}" has been permanently deleted` });
  });

  app.delete('/:id/permanent', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const actor = request.user as { sub: string };
    const user = await prisma.user.findFirst({
      where: { id: request.params.id, tenantId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    if (user.role !== 'student') {
      return reply.status(403).send({ error: 'Only students can be deleted here' });
    }
    if (user.isActive) {
      return reply.status(400).send({ error: 'Student must be archived before permanent deletion' });
    }

    await prisma.$transaction([
      prisma.testAllocation.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    await logRevision({
      tenantId,
      module: 'students',
      entityId: user.id,
      action: 'deleted',
      userId: actor.sub,
      details: { name: user.name, email: user.email },
    });
    return reply.send({ message: `Student "${user.name}" has been permanently deleted` });
  });
}
