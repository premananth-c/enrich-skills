import { createReadStream } from 'fs';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { createBatchVideoSchema, updateBatchVideoSchema } from '@enrich-skills/shared';
import { requireTenant, requireAdmin, authenticate } from '../lib/tenant.js';
import { saveFile, getFilePath, deleteFile, STORAGE_KEYS } from '../lib/storage.js';

export async function batchVideoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/batches/:batchId/videos', async (request: FastifyRequest<{ Params: { batchId: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const videos = await prisma.batchVideo.findMany({
      where: { batchId: request.params.batchId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    return reply.send(videos);
  });

  app.post('/batches/:batchId/videos', async (request: FastifyRequest<{ Params: { batchId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const payload = request.user as { sub: string };
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const data = await (request as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string; mimetype: string } | undefined> }).file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    const buffer = await data.toBuffer();
    const key = await saveFile(STORAGE_KEYS.VIDEOS, data.filename, buffer, data.mimetype);
    const count = await prisma.batchVideo.count({ where: { batchId: request.params.batchId } });
    const video = await prisma.batchVideo.create({
      data: {
        batchId: request.params.batchId,
        title: data.filename,
        storageKey: key,
        mimeType: data.mimetype || 'video/mp4',
        sizeBytes: buffer.length,
        order: count,
        uploadedBy: payload.sub,
      },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    return reply.status(201).send(video);
  });

  app.patch('/batches/:batchId/videos/:videoId', async (request: FastifyRequest<{ Params: { batchId: string; videoId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const parsed = updateBatchVideoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const video = await prisma.batchVideo.update({
      where: { id: request.params.videoId },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description ?? null }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    return reply.send(video);
  });

  app.get('/batches/:batchId/videos/:videoId/stream', async (request: FastifyRequest<{ Params: { batchId: string; videoId: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const video = await prisma.batchVideo.findFirst({
      where: { id: request.params.videoId, batchId: request.params.batchId },
    });
    if (!video) return reply.status(404).send({ error: 'Video not found' });
    const filePath = await getFilePath(video.storageKey);
    if (!filePath) return reply.status(404).send({ error: 'File not found' });
    return reply
      .header('Content-Type', video.mimeType)
      .send(createReadStream(filePath));
  });

  app.delete('/batches/:batchId/videos/:videoId', async (request: FastifyRequest<{ Params: { batchId: string; videoId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const batch = await prisma.batch.findFirst({ where: { id: request.params.batchId, tenantId } });
    if (!batch) return reply.status(404).send({ error: 'Batch not found' });
    const video = await prisma.batchVideo.findFirst({
      where: { id: request.params.videoId, batchId: request.params.batchId },
    });
    if (!video) return reply.status(404).send({ error: 'Video not found' });
    await deleteFile(video.storageKey);
    await prisma.batchVideo.delete({ where: { id: request.params.videoId } });
    return reply.status(204).send();
  });
}
