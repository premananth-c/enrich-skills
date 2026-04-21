import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { loginSchema, registerSchema, registerWithInviteSchema } from '@enrich-skills/shared';
import { randomUUID } from 'crypto';
import { logRevision } from '../lib/revision.js';
import { MODULE_KEYS, type ModuleKey, type PermissionLevel } from '../lib/tenant.js';

async function resolvePermissionsForUser(tenantId: string, role: string): Promise<Record<ModuleKey, PermissionLevel>> {
  if (role === 'super_admin') {
    return {
      courses: 'edit',
      batches: 'edit',
      tests: 'edit',
      questions: 'edit',
      students: 'edit',
      reports: 'edit',
      manage_users: 'edit',
      meetings: 'edit',
    };
  }
  if (role === 'admin') {
    return {
      courses: 'edit',
      batches: 'edit',
      tests: 'edit',
      questions: 'edit',
      students: 'edit',
      reports: 'edit',
      manage_users: 'none',
      meetings: 'edit',
    };
  }
  if (role === 'invited') {
    return {
      courses: 'none',
      batches: 'none',
      tests: 'none',
      questions: 'none',
      students: 'none',
      reports: 'none',
      manage_users: 'none',
      meetings: 'none',
    };
  }
  const base = {
    courses: 'none',
    batches: 'none',
    tests: 'none',
    questions: 'none',
    students: 'none',
    reports: 'none',
    manage_users: 'none',
    meetings: 'none',
  } as Record<ModuleKey, PermissionLevel>;
  const roleDef = await prisma.roleDefinition.findFirst({
    where: { tenantId, roleKey: role, isActive: true },
    select: { permissions: true },
  });
  if (!roleDef?.permissions || typeof roleDef.permissions !== 'object') return base;
  const raw = roleDef.permissions as Record<string, unknown>;
  for (const moduleKey of MODULE_KEYS) {
    const granted = raw[moduleKey];
    if (granted === 'view' || granted === 'edit') {
      base[moduleKey] = granted;
    }
  }
  return base;
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password, name, tenantId } = parsed.data;
    const emailLower = email.trim().toLowerCase();

    let resolvedTenantId: string | undefined = tenantId;
    if (!resolvedTenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ where: { status: 'active' } });
      resolvedTenantId = defaultTenant?.id;
    }
    if (!resolvedTenantId) {
      return reply.status(400).send({ error: 'No tenant available for registration' });
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: resolvedTenantId, email: emailLower } },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId: resolvedTenantId,
        email: emailLower,
        passwordHash,
        name,
        role: 'student',
      },
    });
    await logRevision({
      tenantId: user.tenantId,
      module: 'students',
      entityId: user.id,
      action: 'created',
      details: { name: user.name, email: user.email },
    });

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '8h' }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, jti: randomUUID() },
      { expiresIn: '30d' }
    );

    const permissions = await resolvePermissionsForUser(user.tenantId, user.role);
    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, permissions },
      accessToken,
      refreshToken,
      expiresIn: 28800,
    });
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { email, password } = parsed.data;
      const emailLower = email.trim().toLowerCase();

      const tenantId = (request.headers['x-tenant-id'] as string)?.trim() || undefined;
      const user = tenantId
        ? await prisma.user.findUnique({
            where: { tenantId_email: { tenantId, email: emailLower } },
          })
        : await prisma.user.findFirst({ where: { email: emailLower } });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return reply.status(403).send({ error: 'Your account has been disabled. Please contact your administrator.' });
      }

      const accessToken = app.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, role: user.role },
        { expiresIn: '8h' }
      );
      const refreshToken = app.jwt.sign(
        { sub: user.id, jti: randomUUID() },
        { expiresIn: '30d' }
      );

      const permissions = await resolvePermissionsForUser(user.tenantId, user.role);
      return reply.send({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, permissions },
        accessToken,
        refreshToken,
        expiresIn: 28800,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  });

  app.post('/register-with-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerWithInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ') || 'Validation failed';
      return reply.status(400).send({ error: msg });
    }
    const { token, password, name, phoneNumber, address } = parsed.data;

    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite) {
      return reply.status(400).send({ error: 'Invalid or expired invite link' });
    }
    if (invite.usedAt) {
      return reply.status(400).send({ error: 'This invite has already been used' });
    }
    if (new Date() > invite.expiresAt) {
      return reply.status(400).send({ error: 'This invite has expired' });
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: invite.tenantId, email: invite.email } },
    });
    if (existing) {
      return reply.status(409).send({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId: invite.tenantId,
        email: invite.email,
        passwordHash,
        name,
        phoneNumber,
        address,
        role: 'student',
      },
    });
    await logRevision({
      tenantId: invite.tenantId,
      module: 'students',
      entityId: user.id,
      action: 'created',
      userId: invite.invitedBy,
      details: { name: user.name, email: user.email },
    });

    await prisma.invite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    });

    if (invite.testId) {
      await prisma.testAllocation.upsert({
        where: { userId_testId: { userId: user.id, testId: invite.testId } },
        update: { variantId: invite.variantId ?? null },
        create: {
          userId: user.id,
          testId: invite.testId,
          variantId: invite.variantId ?? null,
          assignedBy: invite.invitedBy,
        },
      });
    }

    if (invite.batchId) {
      const batch = await prisma.batch.findFirst({
        where: { id: invite.batchId, tenantId: invite.tenantId },
      });
      if (batch) {
        await prisma.batchMember.upsert({
          where: { batchId_userId: { batchId: invite.batchId, userId: user.id } },
          update: {},
          create: { batchId: invite.batchId, userId: user.id },
        });
        const batchTests = await prisma.batchTestAssignment.findMany({
          where: { batchId: invite.batchId },
          select: { testId: true },
        });
        for (const bt of batchTests) {
          await prisma.testAllocation.upsert({
            where: { userId_testId: { userId: user.id, testId: bt.testId } },
            update: {},
            create: { userId: user.id, testId: bt.testId, assignedBy: invite.invitedBy },
          });
        }
      }
    }

    if (invite.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: invite.courseId, tenantId: invite.tenantId },
      });
      if (course) {
        const existingAssign = await prisma.courseAssignment.findFirst({
          where: { tenantId: invite.tenantId, courseId: invite.courseId, userId: user.id, batchId: null },
        });
        if (!existingAssign) {
          await prisma.courseAssignment.create({
            data: {
              tenantId: invite.tenantId,
              courseId: invite.courseId,
              userId: user.id,
              batchId: null,
              assignedBy: invite.invitedBy,
              dueDate: invite.courseDueDate ?? null,
            },
          });
        }
      }
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '8h' }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, jti: randomUUID() },
      { expiresIn: '30d' }
    );

    const permissions = await resolvePermissionsForUser(user.tenantId, user.role);
    return reply.status(201).send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, phoneNumber: user.phoneNumber, address: user.address, permissions },
      accessToken,
      refreshToken,
      expiresIn: 28800,
    });
  });

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<{ sub: string }>();
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'User not found' });
      }

      const accessToken = app.jwt.sign(
        { sub: user.id, tenantId: user.tenantId, role: user.role },
        { expiresIn: '8h' }
      );

      return reply.send({ accessToken, expiresIn: 28800 });
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });
}
