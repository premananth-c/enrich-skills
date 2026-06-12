import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { createInviteSchema } from '@enrich-skills/shared';
import { requireModuleAccess } from '../lib/tenant.js';
import { sendInviteEmail } from '../lib/email.js';
import { getTenantWebUrls } from '../lib/tenantUrls.js';
import { resolveClientScope } from '../lib/clientScope.js';
import { resolveStudentClientIds } from '../lib/studentClients.js';

const INVITE_EXPIRY_DAYS = 2;

function parseCourseDueDateYmd(raw: string | undefined): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

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

    const prisma = await request.getTenantPrisma();
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
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const prisma = await request.getTenantPrisma();
    const admin = request.user as { sub: string };

    const parsed = createInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { email, testId, variantId, batchId, courseId, courseDueDate, clientIds: requestedClientIds } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: email.toLowerCase() } },
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
      if (test.status !== 'published') {
        return reply.status(400).send({ error: 'Only published tests can be used in invites. Set the test status to Published first.' });
      }
      testTitle = test.title;
      if (variantId) {
        const variant = await prisma.testVariant.findFirst({ where: { id: variantId, testId } });
        if (!variant) return reply.status(400).send({ error: 'Variant not found' });
      }
    }

    let batchName: string | undefined;
    if (batchId) {
      const batch = await prisma.batch.findFirst({ where: { id: batchId, tenantId } });
      if (!batch) return reply.status(400).send({ error: 'Batch not found' });
      batchName = batch.name;
    }

    let courseName: string | undefined;
    let courseDueDateVal: Date | undefined;
    if (courseId) {
      const course = await prisma.course.findFirst({ where: { id: courseId, tenantId } });
      if (!course) return reply.status(400).send({ error: 'Course not found' });
      courseName = course.title;
      courseDueDateVal = parseCourseDueDateYmd(courseDueDate);
    }

    const scope = await resolveClientScope(request, prisma);
    let inviteClientIds: string[] = [];
    if (batchId) {
      const batch = await prisma.batch.findFirst({ where: { id: batchId, tenantId }, select: { clientId: true } });
      if (batch?.clientId) inviteClientIds = [batch.clientId];
    }
    if (inviteClientIds.length === 0) {
      const resolved = await resolveStudentClientIds(prisma, tenantId, scope, requestedClientIds);
      inviteClientIds = resolved.clientIds;
    }
    const invitePrimaryClientId = inviteClientIds[0];

    const invite = await prisma.invite.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        token,
        expiresAt,
        invitedBy: admin.sub,
        testId: testId || undefined,
        variantId: variantId || undefined,
        batchId: batchId || undefined,
        courseId: courseId || undefined,
        courseDueDate: courseDueDateVal ?? undefined,
        clientId: invitePrimaryClientId ?? undefined,
        clientIds: inviteClientIds,
      },
    });

    const { studentUrl } = await getTenantWebUrls(tenantId);
    await sendInviteEmail(invite.email, invite.token, { testTitle, batchName, courseName }, studentUrl);

    return reply.status(201).send({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
      testId: invite.testId ?? undefined,
      variantId: invite.variantId ?? undefined,
      batchId: invite.batchId ?? undefined,
      courseId: invite.courseId ?? undefined,
      message: 'Invite sent successfully',
    });
  });

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'view');
    const prisma = await request.getTenantPrisma();
    const scope = await resolveClientScope(request, prisma);
    const invites = await prisma.invite.findMany({
      where: {
        tenantId,
        ...(scope.mode === 'client'
          ? {
              OR: [
                { clientId: scope.clientId },
                { clientIds: { has: scope.clientId } },
              ],
            }
          : {}),
      },
      include: {
        test: { select: { id: true, title: true } },
        inviter: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(invites);
  });

  // Resend an invite — resets the expiry to +2 days and re-sends the email
  app.post('/:id/resend', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const prisma = await request.getTenantPrisma();

    const invite = await prisma.invite.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        test: { select: { title: true } },
        batch: { select: { name: true } },
        course: { select: { title: true } },
      },
    });
    if (!invite) return reply.status(404).send({ error: 'Invite not found' });
    if (invite.usedAt) return reply.status(400).send({ error: 'This invite has already been accepted' });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 8);

    const updated = await prisma.invite.update({
      where: { id: invite.id },
      data: { token, expiresAt },
      include: {
        test: { select: { id: true, title: true } },
        batch: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
        inviter: { select: { name: true, email: true } },
      },
    });

    const { studentUrl } = await getTenantWebUrls(tenantId);
    await sendInviteEmail(updated.email, updated.token, {
      testTitle: invite.test?.title,
      batchName: invite.batch?.name,
      courseName: invite.course?.title,
    }, studentUrl);

    return reply.send(updated);
  });

  app.post('/bulk-delete', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const prisma = await request.getTenantPrisma();

    const body = request.body as { ids?: string[] };
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === 'string' && id.length > 0) : [];
    if (ids.length === 0) {
      return reply.status(400).send({ error: 'At least one invite id is required' });
    }

    const result = await prisma.invite.deleteMany({
      where: { id: { in: ids }, tenantId, usedAt: null },
    });

    return reply.send({ deleted: result.count });
  });

  // Revoke (delete) a pending invite
  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = await requireModuleAccess(request, 'students', 'edit');
    const prisma = await request.getTenantPrisma();

    const invite = await prisma.invite.findFirst({
      where: { id: request.params.id, tenantId },
    });
    if (!invite) return reply.status(404).send({ error: 'Invite not found' });
    if (invite.usedAt) return reply.status(400).send({ error: 'Cannot revoke an accepted invite' });

    await prisma.invite.delete({ where: { id: invite.id } });
    return reply.status(204).send();
  });
}
