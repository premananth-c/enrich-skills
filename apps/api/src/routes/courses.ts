import { createReadStream } from 'fs';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  createCourseSchema,
  updateCourseSchema,
  createChapterSchema,
  updateChapterSchema,
  createTopicSchema,
  updateTopicSchema,
  createMaterialSchema,
  updateMaterialSchema,
  createActivitySchema,
  updateActivitySchema,
  createEvaluationSchema,
  updateEvaluationSchema,
} from '@enrich-skills/shared';
import { requireTenant, requireAdmin, authenticate } from '../lib/tenant.js';
import { saveFile, getFilePath, deleteFile, STORAGE_KEYS } from '../lib/storage.js';
import { logRevision } from '../lib/revision.js';

export async function courseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // --- Course CRUD ---
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const { includeArchived } = request.query as { includeArchived?: string };
    const courses = await prisma.course.findMany({
      where: { tenantId, ...(includeArchived === 'true' ? {} : { isArchived: false }) },
      orderBy: { updatedAt: 'desc' },
    });
    return reply.send(courses);
  });

  app.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const course = await prisma.course.findFirst({
      where: { id: request.params.id, tenantId },
      include: {
        chapters: { orderBy: { order: 'asc' }, include: { topics: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    return reply.send(course);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const user = request.user as { sub: string };
    const parsed = createCourseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const course = await prisma.course.create({
      data: {
        tenantId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
      },
    });
    await logRevision({
      tenantId,
      module: 'courses',
      entityId: course.id,
      action: 'created',
      userId: user.sub,
      details: { title: course.title },
    });
    return reply.status(201).send(course);
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const user = request.user as { sub: string };
    const parsed = updateCourseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const existing = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Course not found' });
    const course = await prisma.course.update({
      where: { id: request.params.id },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description ?? null }),
      },
    });
    await logRevision({
      tenantId,
      module: 'courses',
      entityId: course.id,
      action: 'updated',
      userId: user.sub,
      details: { title: course.title },
    });
    return reply.send(course);
  });

  app.patch('/:id/archive', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const user = request.user as { sub: string };
    const existing = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Course not found' });
    const course = await prisma.course.update({
      where: { id: request.params.id },
      data: { isArchived: true },
    });
    await logRevision({
      tenantId,
      module: 'courses',
      entityId: course.id,
      action: 'archived',
      userId: user.sub,
      details: { title: course.title },
    });
    return reply.send(course);
  });

  // --- Chapters ---
  app.get('/:id/chapters', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const chapters = await prisma.courseChapter.findMany({
      where: { courseId: request.params.id },
      orderBy: { order: 'asc' },
      include: { topics: { orderBy: { order: 'asc' } } },
    });
    return reply.send(chapters);
  });

  app.post('/:id/chapters', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = createChapterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const count = await prisma.courseChapter.count({ where: { courseId: request.params.id } });
    const chapter = await prisma.courseChapter.create({
      data: {
        courseId: request.params.id,
        title: parsed.data.title,
        order: parsed.data.order ?? count,
      },
    });
    return reply.status(201).send(chapter);
  });

  app.patch('/:id/chapters/:chapterId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = updateChapterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const chapter = await prisma.courseChapter.update({
      where: { id: request.params.chapterId },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      },
    });
    return reply.send(chapter);
  });

  app.delete('/:id/chapters/:chapterId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    await prisma.courseChapter.delete({ where: { id: request.params.chapterId } });
    return reply.status(204).send();
  });

  // --- Topics ---
  app.post('/:id/chapters/:chapterId/topics', async (request: FastifyRequest<{ Params: { id: string; chapterId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const chapter = await prisma.courseChapter.findFirst({
      where: { id: request.params.chapterId, courseId: request.params.id },
    });
    if (!chapter) return reply.status(404).send({ error: 'Chapter not found' });
    const parsed = createTopicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const count = await prisma.courseTopic.count({ where: { chapterId: request.params.chapterId } });
    const topic = await prisma.courseTopic.create({
      data: {
        chapterId: request.params.chapterId,
        title: parsed.data.title,
        order: parsed.data.order ?? count,
        content: parsed.data.content ?? null,
      },
    });
    return reply.status(201).send(topic);
  });

  app.patch('/:id/chapters/:chapterId/topics/:topicId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = updateTopicSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const topic = await prisma.courseTopic.update({
      where: { id: request.params.topicId },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
        ...(parsed.data.content !== undefined && { content: parsed.data.content ?? null }),
      },
    });
    return reply.send(topic);
  });

  app.delete('/:id/chapters/:chapterId/topics/:topicId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    await prisma.courseTopic.delete({ where: { id: request.params.topicId } });
    return reply.status(204).send();
  });

  // --- Materials (per topic) ---
  app.get('/:id/chapters/:chapterId/topics/:topicId/materials', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const materials = await prisma.courseMaterial.findMany({
      where: { topicId: request.params.topicId },
      orderBy: { order: 'asc' },
    });
    return reply.send(materials);
  });

  app.post('/:id/chapters/:chapterId/topics/:topicId/materials', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = createMaterialSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const count = await prisma.courseMaterial.count({ where: { topicId: request.params.topicId } });
    const material = await prisma.courseMaterial.create({
      data: {
        topicId: request.params.topicId,
        type: parsed.data.type,
        title: parsed.data.title,
        url: parsed.data.url ?? null,
        order: parsed.data.order ?? count,
      },
    });
    return reply.status(201).send(material);
  });

  app.patch('/:id/chapters/:chapterId/topics/:topicId/materials/:materialId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; materialId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = updateMaterialSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const material = await prisma.courseMaterial.update({
      where: { id: request.params.materialId },
      data: {
        ...(parsed.data.type && { type: parsed.data.type }),
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.url !== undefined && { url: parsed.data.url ?? null }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      },
    });
    return reply.send(material);
  });

  app.delete('/:id/chapters/:chapterId/topics/:topicId/materials/:materialId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; materialId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const mat = await prisma.courseMaterial.findFirst({ where: { id: request.params.materialId, topicId: request.params.topicId } });
    if (mat?.storageKey) await deleteFile(mat.storageKey);
    await prisma.courseMaterial.delete({ where: { id: request.params.materialId } });
    return reply.status(204).send();
  });

  // --- Activities ---
  app.get('/:id/chapters/:chapterId/topics/:topicId/activities', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const activities = await prisma.courseActivity.findMany({
      where: { topicId: request.params.topicId },
      orderBy: { order: 'asc' },
    });
    return reply.send(activities);
  });

  app.post('/:id/chapters/:chapterId/topics/:topicId/activities', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = createActivitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const count = await prisma.courseActivity.count({ where: { topicId: request.params.topicId } });
    const activity = await prisma.courseActivity.create({
      data: {
        topicId: request.params.topicId,
        type: parsed.data.type,
        title: parsed.data.title,
        config: (parsed.data.config as object) ?? {},
        order: parsed.data.order ?? count,
      },
    });
    return reply.status(201).send(activity);
  });

  app.patch('/:id/chapters/:chapterId/topics/:topicId/activities/:activityId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; activityId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = updateActivitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const activity = await prisma.courseActivity.update({
      where: { id: request.params.activityId },
      data: {
        ...(parsed.data.type && { type: parsed.data.type }),
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.config && { config: parsed.data.config as object }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      },
    });
    return reply.send(activity);
  });

  app.delete('/:id/chapters/:chapterId/topics/:topicId/activities/:activityId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; activityId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    await prisma.courseActivity.delete({ where: { id: request.params.activityId } });
    return reply.status(204).send();
  });

  // --- Evaluations ---
  app.get('/:id/chapters/:chapterId/topics/:topicId/evaluations', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const evaluations = await prisma.courseEvaluation.findMany({
      where: { topicId: request.params.topicId },
      orderBy: { order: 'asc' },
      include: { test: { select: { id: true, title: true, type: true } } },
    });
    return reply.send(evaluations);
  });

  app.post('/:id/chapters/:chapterId/topics/:topicId/evaluations', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = createEvaluationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const count = await prisma.courseEvaluation.count({ where: { topicId: request.params.topicId } });
    const evaluation = await prisma.courseEvaluation.create({
      data: {
        topicId: request.params.topicId,
        type: parsed.data.type,
        title: parsed.data.title,
        testId: parsed.data.testId ?? null,
        config: (parsed.data.config as object) ?? {},
        order: parsed.data.order ?? count,
      },
    });
    return reply.status(201).send(evaluation);
  });

  app.patch('/:id/chapters/:chapterId/topics/:topicId/evaluations/:evaluationId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; evaluationId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const parsed = updateEvaluationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const evaluation = await prisma.courseEvaluation.update({
      where: { id: request.params.evaluationId },
      data: {
        ...(parsed.data.type && { type: parsed.data.type }),
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.testId !== undefined && { testId: parsed.data.testId ?? null }),
        ...(parsed.data.config && { config: parsed.data.config as object }),
        ...(parsed.data.order !== undefined && { order: parsed.data.order }),
      },
    });
    return reply.send(evaluation);
  });

  app.delete('/:id/chapters/:chapterId/topics/:topicId/evaluations/:evaluationId', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; evaluationId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    await prisma.courseEvaluation.delete({ where: { id: request.params.evaluationId } });
    return reply.status(204).send();
  });

  // --- Material download (PDF by storageKey) ---
  app.get('/:id/chapters/:chapterId/topics/:topicId/materials/:materialId/download', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string; materialId: string } }>, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const material = await prisma.courseMaterial.findFirst({
      where: { id: request.params.materialId, topicId: request.params.topicId, storageKey: { not: null } },
    });
    if (!material?.storageKey) return reply.status(404).send({ error: 'Material or file not found' });
    const filePath = await getFilePath(material.storageKey);
    if (!filePath) return reply.status(404).send({ error: 'File not found' });
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(material.title)}"`)
      .send(createReadStream(filePath));
  });

  // --- Material PDF upload (multipart) ---
  app.post('/:id/chapters/:chapterId/topics/:topicId/materials/upload', async (request: FastifyRequest<{ Params: { id: string; chapterId: string; topicId: string } }>, reply: FastifyReply) => {
    const tenantId = requireAdmin(request);
    const course = await prisma.course.findFirst({ where: { id: request.params.id, tenantId } });
    if (!course) return reply.status(404).send({ error: 'Course not found' });
    const data = await (request as unknown as { file: () => Promise<{ toBuffer: () => Promise<Buffer>; filename: string; mimetype: string } | undefined> }).file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });
    const buffer = await data.toBuffer();
    const key = await saveFile(STORAGE_KEYS.MATERIALS, data.filename, buffer, data.mimetype);
    const count = await prisma.courseMaterial.count({ where: { topicId: request.params.topicId } });
    const material = await prisma.courseMaterial.create({
      data: {
        topicId: request.params.topicId,
        type: 'pdf',
        title: data.filename,
        storageKey: key,
        order: count,
      },
    });
    return reply.status(201).send(material);
  });
}
