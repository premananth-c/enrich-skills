import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { getFileStreamWithRange, getFileStream } from '../lib/storage.js';
import { authenticate } from '../lib/tenant.js';
import { isAllowedDomain } from '../lib/domainCheck.js';

function createStreamToken(
  app: FastifyInstance,
  payload: { materialId: string; storageKey: string; mimeType: string }
): string {
  return app.jwt.sign(
    { sub: 'stream', ...payload },
    { expiresIn: '2h' }
  );
}

export async function streamRoutes(app: FastifyInstance) {
  // Authenticated: generate a short-lived stream token for a material
  app.get<{ Params: { materialId: string } }>(
    '/materials/:materialId/token',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const material = await prisma.courseMaterial.findFirst({
        where: { id: request.params.materialId, type: 'video', storageKey: { not: null } },
      });
      if (!material?.storageKey) {
        return reply.status(404).send({ error: 'Video material not found' });
      }

      const token = createStreamToken(app, {
        materialId: material.id,
        storageKey: material.storageKey,
        mimeType: material.mimeType ?? 'video/mp4',
      });

      return reply.send({ url: `/api/v1/stream/video?t=${token}` });
    }
  );

  // Authenticated: generate a short-lived stream token for a PDF material
  app.get<{ Params: { materialId: string } }>(
    '/materials/:materialId/pdf-token',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const material = await prisma.courseMaterial.findFirst({
        where: { id: request.params.materialId, type: 'pdf', storageKey: { not: null } },
      });
      if (!material?.storageKey) {
        return reply.status(404).send({ error: 'PDF material not found' });
      }

      const token = createStreamToken(app, {
        materialId: material.id,
        storageKey: material.storageKey,
        mimeType: 'application/pdf',
      });

      return reply.send({ url: `/api/v1/stream/pdf?t=${token}` });
    }
  );

  // Public: proxy-stream a PDF using the signed token (no auth header needed)
  app.get(
    '/pdf',
    async (request: FastifyRequest<{ Querystring: { t?: string } }>, reply: FastifyReply) => {
      const token = (request.query as { t?: string }).t;
      if (!token) {
        return reply.status(400).send({ error: 'Missing stream token' });
      }

      const origin = request.headers.origin;
      const referer = request.headers.referer;
      const allowed = await isAllowedDomain(origin, referer);
      if (!allowed) {
        return reply.status(403).send({ error: 'Streaming not allowed from this domain' });
      }

      let payload: { materialId: string; storageKey: string; mimeType: string };
      try {
        payload = app.jwt.verify<{ materialId: string; storageKey: string; mimeType: string }>(token);
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired stream token' });
      }

      const stream = await getFileStream(payload.storageKey);
      if (!stream) {
        return reply.status(404).send({ error: 'PDF file not found in storage' });
      }

      return reply
        .status(200)
        .headers({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        })
        .send(stream);
    }
  );

  // Public: proxy-stream a video using the signed token (no auth header needed)
  app.get(
    '/video',
    async (request: FastifyRequest<{ Querystring: { t?: string } }>, reply: FastifyReply) => {
      const token = (request.query as { t?: string }).t;
      if (!token) {
        return reply.status(400).send({ error: 'Missing stream token' });
      }

      // Verify domain
      const origin = request.headers.origin;
      const referer = request.headers.referer;
      const allowed = await isAllowedDomain(origin, referer);
      if (!allowed) {
        return reply.status(403).send({ error: 'Streaming not allowed from this domain' });
      }

      // Verify token
      let payload: { materialId: string; storageKey: string; mimeType: string };
      try {
        payload = app.jwt.verify<{ materialId: string; storageKey: string; mimeType: string }>(token);
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired stream token' });
      }

      const rangeHeader = request.headers.range;
      const result = await getFileStreamWithRange(payload.storageKey, rangeHeader);
      if (!result) {
        return reply.status(404).send({ error: 'Video file not found in storage' });
      }

      const headers: Record<string, string> = {
        'Content-Type': payload.mimeType || result.contentType,
        'Content-Length': String(result.contentLength),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      };
      if (result.contentRange) {
        headers['Content-Range'] = result.contentRange;
      }

      return reply
        .status(result.statusCode)
        .headers(headers)
        .send(result.stream);
    }
  );
}
