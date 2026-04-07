import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createMeetingSchema, updateMeetingSchema, sendMeetingInviteSchema } from '@enrich-skills/shared';
import { authenticate, requireTenant, requireAdmin } from '../lib/tenant.js';
import { createRoom, createMeetingToken, deleteRoom, isDailyConfigured } from '../lib/daily.js';
import { sendMeetingInviteEmail } from '../lib/email.js';

function sanitizeRoomName(name: string, id: string): string {
  return (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30) + '-' + id.slice(0, 8));
}

export async function meetingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List meetings for tenant (optionally filter by batchId)
  app.get('/', async (request: FastifyRequest<{ Querystring: { batchId?: string; status?: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const { batchId, status } = request.query;
    const where: Record<string, unknown> = { tenantId };
    if (batchId) where.batchId = batchId;
    if (status) where.status = status;

    const meetings = await prisma.liveMeeting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        host: { select: { id: true, name: true, email: true } },
        batch: { select: { id: true, name: true } },
      },
    });
    return reply.send(meetings);
  });

  // Get single meeting
  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const meeting = await prisma.liveMeeting.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        host: { select: { id: true, name: true, email: true } },
        batch: { select: { id: true, name: true } },
        recordings: true,
      },
    });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });
    return reply.send(meeting);
  });

  // Create meeting
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const payload = request.user as { sub: string };
    const parsed = createMeetingSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { name, type, maxParticipants, batchId, scheduledAt, coHostUserIds, config } = parsed.data;

    const meetingId = crypto.randomUUID();
    const roomName = sanitizeRoomName(name, meetingId);

    const isWebinar = type === 'webinar';
    const meetingConfig = config ?? (isWebinar
      ? { chatMode: 'everyone' }
      : { participantVideoDefaultOn: true, participantAudioDefaultOn: true, allowParticipantScreenShare: false, chatMode: 'everyone' });

    const interactiveConfig = meetingConfig as { participantVideoDefaultOn?: boolean; participantAudioDefaultOn?: boolean; allowParticipantScreenShare?: boolean };

    let providerRoomId: string | null = null;
    let providerRoomUrl: string | null = null;

    if (isDailyConfigured()) {
      const room = await createRoom({
        name: roomName,
        maxParticipants,
        isWebinar,
        startVideoOff: isWebinar ? true : !(interactiveConfig.participantVideoDefaultOn ?? true),
        startAudioOff: isWebinar ? true : !(interactiveConfig.participantAudioDefaultOn ?? true),
        enableScreenShare: isWebinar ? false : (interactiveConfig.allowParticipantScreenShare ?? false),
        enableChat: (meetingConfig as { chatMode?: string }).chatMode !== 'off',
      });
      providerRoomId = room.id;
      providerRoomUrl = room.url;
    }

    const meeting = await prisma.liveMeeting.create({
      data: {
        id: meetingId,
        tenantId,
        batchId: batchId ?? null,
        name,
        type,
        maxParticipants,
        provider: 'daily',
        providerRoomId,
        providerRoomUrl,
        config: meetingConfig as object,
        hostUserId: payload.sub,
        coHostUserIds: coHostUserIds ?? [],
        status: 'scheduled',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: {
        host: { select: { id: true, name: true, email: true } },
        batch: { select: { id: true, name: true } },
      },
    });

    return reply.status(201).send(meeting);
  });

  // Update meeting
  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const parsed = updateMeetingSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.liveMeeting.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Meeting not found' });

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status === 'ended') data.endedAt = new Date();
    }
    if (parsed.data.config !== undefined) data.config = parsed.data.config as object;
    if (parsed.data.coHostUserIds !== undefined) data.coHostUserIds = parsed.data.coHostUserIds;

    const meeting = await prisma.liveMeeting.update({
      where: { id: request.params.id },
      data,
      include: {
        host: { select: { id: true, name: true, email: true } },
        batch: { select: { id: true, name: true } },
      },
    });
    return reply.send(meeting);
  });

  // Delete meeting
  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const meeting = await prisma.liveMeeting.findFirst({ where: { id: request.params.id, tenantId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });

    if (meeting.providerRoomId && isDailyConfigured()) {
      const roomName = meeting.providerRoomUrl?.split('/').pop();
      if (roomName) {
        try { await deleteRoom(roomName); } catch { /* provider cleanup is best-effort */ }
      }
    }

    await prisma.liveMeeting.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });

  // Get join token for the current user
  app.post('/:id/join-token', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const payload = request.user as { sub: string; role?: string };

    const meeting = await prisma.liveMeeting.findFirst({ where: { id: request.params.id, tenantId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });
    if (!meeting.providerRoomUrl) return reply.status(400).send({ error: 'Meeting room not provisioned (Daily API key may not be configured)' });

    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const isHost = meeting.hostUserId === payload.sub;
    const isCoHost = meeting.coHostUserIds.includes(payload.sub);
    const isOwner = isHost || isCoHost;

    const roomName = meeting.providerRoomUrl.split('/').pop()!;
    const token = await createMeetingToken({
      roomName,
      userId: user.id,
      userName: user.name,
      isOwner,
    });

    return reply.send({
      token,
      roomUrl: meeting.providerRoomUrl,
      isOwner,
      meetingType: meeting.type,
      config: meeting.config,
    });
  });

  // Send invite emails
  app.post('/:id/send-invite', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const parsed = sendMeetingInviteSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const meeting = await prisma.liveMeeting.findFirst({ where: { id: request.params.id, tenantId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });

    const studentBaseUrl = process.env.INVITE_BASE_URL || 'http://localhost:5173';
    const joinUrl = `${studentBaseUrl}/meeting/${meeting.id}`;

    const results: { email: string; status: string }[] = [];
    for (const email of parsed.data.emails) {
      try {
        await sendMeetingInviteEmail(email, meeting.name, joinUrl, meeting.type as 'interactive_meeting' | 'webinar', meeting.scheduledAt);
        results.push({ email, status: 'sent' });
      } catch {
        results.push({ email, status: 'failed' });
      }
    }

    return reply.send({ sent: results.filter((r) => r.status === 'sent').length, failed: results.filter((r) => r.status === 'failed').length, results });
  });

  // Get shareable link (public, no token needed for viewing)
  app.get('/:id/share-link', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const meeting = await prisma.liveMeeting.findFirst({ where: { id: request.params.id, tenantId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });

    const studentBaseUrl = process.env.INVITE_BASE_URL || 'http://localhost:5173';
    const link = `${studentBaseUrl}/meeting/${meeting.id}`;
    return reply.send({ link });
  });
}
