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
import { courseRoutes } from './routes/courses.js';
import { courseAssignmentRoutes } from './routes/courseAssignments.js';
import { scheduleRoutes } from './routes/schedule.js';
import { schedulerNotesRoutes } from './routes/schedulerNotes.js';
import { batchVideoRoutes } from './routes/batchVideos.js';
import { reportsRoutes } from './routes/reports.js';
import { prisma } from './lib/prisma.js';

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(tenantRoutes, { prefix: '/api/v1/tenants' });
  app.register(testRoutes, { prefix: '/api/v1/tests' });
  app.register(questionRoutes, { prefix: '/api/v1/questions' });
  app.register(attemptRoutes, { prefix: '/api/v1/attempts' });
  app.register(studentRoutes, { prefix: '/api/v1/student' });
  app.register(userRoutes, { prefix: '/api/v1/users' });
  app.register(inviteRoutes, { prefix: '/api/v1/invites' });
  app.register(batchRoutes, { prefix: '/api/v1/batches' });
  app.register(courseRoutes, { prefix: '/api/v1/courses' });
  app.register(courseAssignmentRoutes, { prefix: '/api/v1/course-assignments' });
  app.register(scheduleRoutes, { prefix: '/api/v1/schedule' });
  app.register(schedulerNotesRoutes, { prefix: '/api/v1/schedule' });
  app.register(batchVideoRoutes, { prefix: '/api/v1/schedule' });
  app.register(reportsRoutes, { prefix: '/api/v1/reports' });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen({ port, host: '0.0.0.0' });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
