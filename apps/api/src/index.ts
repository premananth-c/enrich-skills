import './instrument.js';
import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { authRoutes } from './routes/auth.js';
import { tenantRoutes } from './routes/tenant.js';
import { testRoutes } from './routes/test.js';
import { questionRoutes } from './routes/question.js';
import { attemptRoutes } from './routes/attempt.js';
import { studentRoutes } from './routes/student.js';
import { userRoutes } from './routes/users.js';
import { inviteRoutes } from './routes/invites.js';
import { batchRoutes } from './routes/batches.js';
import { clientRoutes } from './routes/clients.js';
import { courseRoutes } from './routes/courses.js';
import { courseAssignmentRoutes } from './routes/courseAssignments.js';
import { scheduleRoutes } from './routes/schedule.js';
import { schedulerNotesRoutes } from './routes/schedulerNotes.js';
import { batchVideoRoutes } from './routes/batchVideos.js';
import { reportsRoutes } from './routes/reports.js';
import { revisionRoutes } from './routes/revisions.js';
import { enquiryRoutes } from './routes/enquiries.js';
import { streamRoutes } from './routes/stream.js';
import { meetingRoutes, meetingWebhookRoutes } from './routes/meetings.js';
import { superAdminAuthRoutes, superAdminTenantRoutes } from './routes/superadmin.js';
import { brandingRoutes } from './routes/branding.js';
import { paymentRoutes, paymentWebhookRoutes } from './routes/payments.js';
import { prisma } from './lib/prisma.js';
import { controlPrisma } from './lib/controlPrisma.js';
import { disconnectAllTenantClients } from './lib/tenantPrisma.js';
import { getAllAllowedOrigins } from './lib/domainCheck.js';
import tenantContextPlugin from './plugins/tenantContext.js';

const app = Fastify({ logger: true });

const STATIC_CORS_ORIGINS = [
  'https://rankership.com',
  'https://www.rankership.com',
  'https://student.rankership.com',
  'https://admin.rankership.com',
  'https://superadmin.rankership.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
];

async function main() {
  await app.register(cors, {
    origin: async (origin: string | undefined) => {
      if (!origin) return true;
      if (STATIC_CORS_ORIGINS.includes(origin)) return true;
      const dynamic = await getAllAllowedOrigins();
      return dynamic.includes(origin);
    },
  });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
  await app.register(tenantContextPlugin);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'ok' };
    } catch (e) {
      reply.code(503);
      return { status: 'degraded', db: 'error', error: String(e) };
    }
  });

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(tenantRoutes, { prefix: '/api/v1/tenants' });
  app.register(testRoutes, { prefix: '/api/v1/tests' });
  app.register(questionRoutes, { prefix: '/api/v1/questions' });
  app.register(attemptRoutes, { prefix: '/api/v1/attempts' });
  app.register(studentRoutes, { prefix: '/api/v1/student' });
  app.register(userRoutes, { prefix: '/api/v1/users' });
  app.register(inviteRoutes, { prefix: '/api/v1/invites' });
  app.register(batchRoutes, { prefix: '/api/v1/batches' });
  app.register(clientRoutes, { prefix: '/api/v1/clients' });
  app.register(courseRoutes, { prefix: '/api/v1/courses' });
  app.register(courseAssignmentRoutes, { prefix: '/api/v1/course-assignments' });
  app.register(scheduleRoutes, { prefix: '/api/v1/schedule' });
  app.register(schedulerNotesRoutes, { prefix: '/api/v1/schedule' });
  app.register(batchVideoRoutes, { prefix: '/api/v1/schedule' });
  app.register(reportsRoutes, { prefix: '/api/v1/reports' });
  app.register(revisionRoutes, { prefix: '/api/v1/revisions' });
  app.register(enquiryRoutes, { prefix: '/api/v1/enquiries' });
  app.register(streamRoutes, { prefix: '/api/v1/stream' });
  app.register(meetingRoutes, { prefix: '/api/v1/meetings' });
  app.register(meetingWebhookRoutes, { prefix: '/api/v1/meetings' });
  app.register(superAdminAuthRoutes, { prefix: '/api/v1/superadmin/auth' });
  app.register(superAdminTenantRoutes, { prefix: '/api/v1/superadmin/tenants' });
  app.register(brandingRoutes, { prefix: '/api/v1/branding' });
  app.register(paymentRoutes, { prefix: '/api/v1/payments' });
  app.register(paymentWebhookRoutes, { prefix: '/api/v1/payments/webhook' });

  Sentry.setupFastifyErrorHandler(app);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
}

async function disconnectAll(): Promise<void> {
  await Promise.all([
    prisma.$disconnect().catch(() => undefined),
    controlPrisma.$disconnect().catch(() => undefined),
    disconnectAllTenantClients(),
  ]);
}

main()
  .then(() => disconnectAll())
  .catch(async (e) => {
    console.error(e);
    await disconnectAll();
    process.exit(1);
  });
