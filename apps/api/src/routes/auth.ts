import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { loginSchema, registerSchema } from '@enrich-skills/shared';
import { randomUUID } from 'crypto';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password, name, tenantId } = parsed.data;

    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const defaultTenant = await prisma.tenant.findFirst({ where: { status: 'active' } });
      resolvedTenantId = defaultTenant?.id ?? null;
    }
    if (!resolvedTenantId) {
      return reply.status(400).send({ error: 'No tenant available for registration' });
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: resolvedTenantId, email } },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId: resolvedTenantId,
        email,
        passwordHash,
        name,
        role: 'student',
      },
    });

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '15m' }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, jti: randomUUID() },
      { expiresIn: '7d' }
    );

    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
      accessToken,
      refreshToken,
      expiresIn: 900,
    });
  });

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const tenantId = (request.headers['x-tenant-id'] as string) || undefined;
    const user = tenantId
      ? await prisma.user.findUnique({
          where: { tenantId_email: { tenantId, email } },
        })
      : await prisma.user.findFirst({ where: { email } });

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const accessToken = app.jwt.sign(
      { sub: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '15m' }
    );
    const refreshToken = app.jwt.sign(
      { sub: user.id, jti: randomUUID() },
      { expiresIn: '7d' }
    );

    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId },
      accessToken,
      refreshToken,
      expiresIn: 900,
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
        { expiresIn: '15m' }
      );

      return reply.send({ accessToken, expiresIn: 900 });
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });
}
