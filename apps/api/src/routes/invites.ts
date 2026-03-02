import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { createInviteSchema } from '@enrich-skills/shared';
import { requireAdmin } from '../lib/tenant.js';
import { sendInviteEmail } from '../lib/email.js';

const INVITE_EXPIRY_DAYS = 2;

export async function inviteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.includes('/validate') && request.method === 'GET') return;
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/validate', async (request: FastifyRequest<{ Querystring: { token: string } }>, reply: FastifyReply) => {
    const token = request.query.token;
    if (!token) {
      return reply.status(400).send({ error: 'Token is required' });
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { test: { select: { title: true } } },
    });

    if (!invite) {
      return reply.status(404).send({ error: 'Invalid or expired invite link' });
    }
    if (invite.usedAt) {
      return reply.status(400).send({ error: 'This invite has already been used' });
    }
    if (new Date() > invite.expiresAt) {
      return reply.status(400).send({ error: 'This invite has expired' });
    }

    return reply.send({
      valid: true,
      email: invite.email,
      expiresAt: invite.expiresAt,
      testTitle: invite.test?.title,
    });
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const admin = request.user as { sub: string };

    const parsed = createInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, testId, variantId } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existingUser) {
      return reply.status(409).send({ error: 'A student with this email is already registered' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);

    let testTitle: string | undefined;
    if (testId) {
      const test = await prisma.test.findFirst({ where: { id: testId, tenantId } });
      if (!test) return reply.status(400).send({ error: 'Test not found' });
      testTitle = test.title;
      if (variantId) {
        const variant = await prisma.testVariant.findFirst({ where: { id: variantId, testId } });
        if (!variant) return reply.status(400).send({ error: 'Variant not found' });
      }
    }

    const invite = await prisma.invite.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        token,
        expiresAt,
        invitedBy: admin.sub,
        testId: testId || undefined,
        variantId: variantId || undefined,
      },
    });

    await sendInviteEmail(invite.email, invite.token, testTitle);

    return reply.status(201).send({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
      testId: invite.testId ?? undefined,
      variantId: invite.variantId ?? undefined,
      message: 'Invite sent successfully',
    });
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const invites = await prisma.invite.findMany({
      where: { tenantId },
      include: {
        test: { select: { id: true, title: true } },
        inviter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(invites);
  });
}
