import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireTenant } from '../lib/tenant.js';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

function getUserId(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub;
}

async function getMyBatchIds(userId: string): Promise<string[]> {
  const memberships = await prisma.batchMember.findMany({
    where: { userId },
    select: { batchId: true },
  });
  return memberships.map((m) => m.batchId);
}

export async function studentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /dashboard
  app.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const userId = getUserId(request);
    const batchIds = await getMyBatchIds(userId);

    const [allocatedTests, courseAssignments, upcomingEvents, unreadCount, recentAttempts] =
      await Promise.all([
        prisma.testAllocation.findMany({
          where: { userId, test: { status: 'published' } },
          include: {
            test: { select: { id: true, title: true, type: true, status: true, config: true, schedule: true } },
          },
          take: 5,
          orderBy: { assignedAt: 'desc' },
        }),
        prisma.courseAssignment.findMany({
          where: {
            tenantId,
            OR: [{ userId }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])],
          },
          include: { course: { select: { id: true, title: true, description: true } } },
          take: 3,
        }),
        batchIds.length
          ? prisma.batchScheduleEvent.findMany({
              where: { batchId: { in: batchIds }, startAt: { gte: new Date() } },
              orderBy: { startAt: 'asc' },
              take: 5,
            })
          : [],
        prisma.notification.count({ where: { userId, tenantId, isRead: false } }),
        prisma.attempt.findMany({
          where: { userId },
          include: { test: { select: { title: true } } },
          orderBy: { startedAt: 'desc' },
          take: 5,
        }),
      ]);

    return reply.send({
      allocatedTests,
      courseAssignments,
      upcomingEvents,
      unreadCount,
      recentAttempts,
    });
  });

  // GET /tests — allocated tests for current student
  app.get('/tests', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);

    const allocations = await prisma.testAllocation.findMany({
      where: { userId },
      include: {
        test: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            config: true,
            schedule: true,
            _count: { select: { testQuestions: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    const publishedAllocations = allocations.filter((a) => a.test.status === 'published');

    const attemptCounts = await prisma.attempt.groupBy({
      by: ['testId'],
      where: { userId, testId: { in: publishedAllocations.map((a) => a.testId) } },
      _count: true,
    });
    const countMap = new Map(attemptCounts.map((c) => [c.testId, c._count]));

    const attempts = await prisma.attempt.findMany({
      where: { userId, testId: { in: publishedAllocations.map((a) => a.testId) } },
      select: {
        id: true,
        testId: true,
        startedAt: true,
        submittedAt: true,
        score: true,
        maxScore: true,
        status: true,
      },
      orderBy: { startedAt: 'desc' },
    });
    const attemptsByTest = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const list = attemptsByTest.get(attempt.testId) ?? [];
      list.push(attempt);
      attemptsByTest.set(attempt.testId, list);
    }

    const tests = publishedAllocations.map((alloc) => {
      const testAttempts = attemptsByTest.get(alloc.testId) ?? [];
      const completedAttempts = testAttempts.filter((a) => a.submittedAt);
      const latestCompleted = completedAttempts[0] ?? null;
      const testConfig = alloc.test.config as {
        attemptLimit?: number;
        passPercentage?: number;
      };
      const passPercentage = testConfig.passPercentage ?? 40;
      const percentage =
        latestCompleted?.maxScore && latestCompleted.maxScore > 0
          ? ((latestCompleted.score ?? 0) / latestCompleted.maxScore) * 100
          : null;

      return {
        ...alloc,
        attemptCount: countMap.get(alloc.testId) ?? 0,
        attempts: testAttempts,
        latestCompletedAttempt: latestCompleted
          ? {
              ...latestCompleted,
              percentage,
              passPercentage,
              result: percentage != null && percentage >= passPercentage ? 'pass' : 'fail',
            }
          : null,
      };
    });

    return reply.send(tests);
  });

  // GET /courses — courses assigned to student
  app.get('/courses', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const userId = getUserId(request);
    const batchIds = await getMyBatchIds(userId);

    const assignments = await prisma.courseAssignment.findMany({
      where: {
        tenantId,
        OR: [{ userId }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])],
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            chapters: {
              select: {
                id: true,
                topics: {
                  select: {
                    id: true,
                    activities: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
        batch: { select: { id: true, name: true } },
      },
    });

    const courseIds = [...new Set(assignments.map((a) => a.courseId))];
    const mySubmissions = await prisma.activitySubmission.findMany({
      where: { userId, activity: { topic: { chapter: { courseId: { in: courseIds } } } } },
      select: { activityId: true },
    });
    const submittedActivityIds = new Set(mySubmissions.map((s) => s.activityId));

    const result = assignments.map((a) => {
      const totalActivities = a.course.chapters.reduce(
        (sum, ch) => sum + ch.topics.reduce((ts, t) => ts + t.activities.length, 0),
        0
      );
      const completedActivities = a.course.chapters.reduce(
        (sum, ch) =>
          sum + ch.topics.reduce((ts, t) => ts + t.activities.filter((act) => submittedActivityIds.has(act.id)).length, 0),
        0
      );
      return {
        id: a.id,
        courseId: a.courseId,
        batchId: a.batchId,
        batchName: a.batch?.name ?? null,
        dueDate: a.dueDate,
        assignedAt: a.assignedAt,
        course: { id: a.course.id, title: a.course.title, description: a.course.description },
        totalActivities,
        completedActivities,
      };
    });

    return reply.send(result);
  });

  // GET /courses/:courseId — full course details
  app.get(
    '/courses/:courseId',
    async (request: FastifyRequest<{ Params: { courseId: string } }>, reply: FastifyReply) => {
      const tenantId = requireTenant(request);
      const userId = getUserId(request);
      const batchIds = await getMyBatchIds(userId);

      const assignment = await prisma.courseAssignment.findFirst({
        where: {
          tenantId,
          courseId: request.params.courseId,
          OR: [{ userId }, ...(batchIds.length ? [{ batchId: { in: batchIds } }] : [])],
        },
      });
      if (!assignment) {
        return reply.status(404).send({ error: 'Course not found or not assigned to you' });
      }

      const course = await prisma.course.findUnique({
        where: { id: request.params.courseId },
        include: {
          chapters: {
            orderBy: { order: 'asc' },
            include: {
              topics: {
                orderBy: { order: 'asc' },
                include: {
                  materials: { orderBy: { order: 'asc' } },
                  activities: { orderBy: { order: 'asc' } },
                  evaluations: {
                    orderBy: { order: 'asc' },
                    include: { test: { select: { id: true, title: true, type: true, status: true } } },
                  },
                },
              },
            },
          },
        },
      });

      const mySubmissions = await prisma.activitySubmission.findMany({
        where: { userId, activity: { topic: { chapter: { courseId: request.params.courseId } } } },
      });
      const submissionMap = new Map(mySubmissions.map((s) => [s.activityId, s]));

      return reply.send({ course, assignment, mySubmissions: Object.fromEntries(submissionMap) });
    }
  );

  // GET /batches
  app.get('/batches', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const memberships = await prisma.batchMember.findMany({
      where: { userId },
      include: { batch: { select: { id: true, name: true, description: true } } },
    });
    return reply.send(memberships);
  });

  // GET /calendar?from=ISO&to=ISO
  app.get('/calendar', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const batchIds = await getMyBatchIds(userId);
    if (!batchIds.length) return reply.send([]);

    const query = request.query as { from?: string; to?: string };
    const from = query.from ? new Date(query.from) : new Date();
    const to = query.to
      ? new Date(query.to)
      : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await prisma.batchScheduleEvent.findMany({
      where: {
        batchId: { in: batchIds },
        startAt: { gte: from },
        endAt: { lte: to },
      },
      include: {
        batch: { select: { name: true } },
        course: { select: { title: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return reply.send(events);
  });

  // GET /notifications?unread=true
  app.get('/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = requireTenant(request);
    const userId = getUserId(request);
    const query = request.query as { unread?: string };

    const where: Record<string, unknown> = { userId, tenantId };
    if (query.unread === 'true') where.isRead = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send(notifications);
  });

  // PATCH /notifications/:id/read
  app.patch(
    '/notifications/:id/read',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const notification = await prisma.notification.findFirst({
        where: { id: request.params.id, userId },
      });
      if (!notification) return reply.status(404).send({ error: 'Notification not found' });

      await prisma.notification.update({
        where: { id: request.params.id },
        data: { isRead: true },
      });

      return reply.send({ success: true });
    }
  );

  // POST /activities/:activityId/submit — file upload
  app.post(
    '/activities/:activityId/submit',
    async (request: FastifyRequest<{ Params: { activityId: string } }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const { activityId } = request.params;

      const activity = await prisma.courseActivity.findUnique({ where: { id: activityId } });
      if (!activity) return reply.status(404).send({ error: 'Activity not found' });

      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });

      const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
      const dir = join(uploadDir, 'activity-submissions');
      await mkdir(dir, { recursive: true });

      const ext = data.filename.split('.').pop() || 'bin';
      const storageKey = `activity-submissions/${randomUUID()}.${ext}`;
      const filePath = join(uploadDir, storageKey);

      const buffer = await data.toBuffer();
      await writeFile(filePath, buffer);

      const submission = await prisma.activitySubmission.upsert({
        where: { activityId_userId: { activityId, userId } },
        create: {
          activityId,
          userId,
          storageKey,
          fileName: data.filename,
          fileSizeBytes: buffer.length,
        },
        update: {
          storageKey,
          fileName: data.filename,
          fileSizeBytes: buffer.length,
        },
      });

      return reply.send(submission);
    }
  );

  // GET /activities/:activityId/submission
  app.get(
    '/activities/:activityId/submission',
    async (request: FastifyRequest<{ Params: { activityId: string } }>, reply: FastifyReply) => {
      const userId = getUserId(request);
      const submission = await prisma.activitySubmission.findUnique({
        where: { activityId_userId: { activityId: request.params.activityId, userId } },
      });
      if (!submission) return reply.status(404).send({ error: 'No submission found' });
      return reply.send(submission);
    }
  );
}
