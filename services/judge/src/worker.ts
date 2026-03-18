import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { runCode } from './runner.js';

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface JudgeJobData {
  submissionId: string;
  attemptId: string;
  questionId: string;
  code: string;
  language: string;
}

function normalizeOutput(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

async function processSubmission(job: Job<JudgeJobData>) {
  const { submissionId, attemptId, questionId, code, language } = job.data;
  console.log(`[Judge] Processing submission ${submissionId} for question ${questionId}`);

  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: 'running' },
  });

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { testCases: true },
  });

  if (!question) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'error', errorMessage: 'Question not found' },
    });
    return;
  }

  const content = question.content as { timeLimitMs?: number; memoryLimitMb?: number };
  const timeLimitMs = content.timeLimitMs ?? 5000;
  const memoryLimitMb = content.memoryLimitMb ?? 256;

  const testCases = question.testCases;
  if (testCases.length === 0) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'error', errorMessage: 'No test cases defined for this question', score: 0 },
    });
    return;
  }

  let totalWeightPassed = 0;
  let totalWeight = 0;
  let hasError = false;
  let firstError = '';
  const caseResults: Array<{
    testCaseId: string;
    passed: boolean;
    actualOutput: string | null;
    executionTimeMs: number | null;
    timedOut: boolean;
  }> = [];

  for (const tc of testCases) {
    totalWeight += tc.weight;

    const result = await runCode(code, language, tc.input, timeLimitMs, memoryLimitMb);

    const actual = normalizeOutput(result.stdout);
    const expected = normalizeOutput(tc.expectedOutput);
    const passed = result.exitCode === 0 && !result.timedOut && actual === expected;

    if (passed) {
      totalWeightPassed += tc.weight;
    }

    if (!passed && !hasError) {
      hasError = true;
      if (result.timedOut) {
        firstError = 'Time limit exceeded';
      } else if (result.exitCode !== 0) {
        firstError = result.stderr.slice(0, 500) || `Exit code: ${result.exitCode}`;
      } else {
        firstError = `Wrong answer on test case`;
      }
    }

    caseResults.push({
      testCaseId: tc.id,
      passed,
      actualOutput: actual.slice(0, 10000),
      executionTimeMs: result.executionTimeMs,
      timedOut: result.timedOut,
    });
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { test: { select: { config: true } } },
  });

  const config = (attempt?.test?.config ?? {}) as { partialScoring?: boolean };
  let score: number;
  if (config.partialScoring === false) {
    score = totalWeightPassed === totalWeight && totalWeight > 0 ? totalWeight : 0;
  } else {
    score = totalWeightPassed;
  }

  const allPassed = totalWeightPassed === totalWeight && totalWeight > 0;
  const status = allPassed ? 'passed' : 'failed';

  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status,
        score,
        output: caseResults.map((r, i) =>
          `Case ${i + 1}: ${r.passed ? 'PASS' : 'FAIL'}${r.timedOut ? ' (TLE)' : ''}`
        ).join('\n'),
        errorMessage: firstError || null,
        executionDetails: {
          totalWeight,
          totalWeightPassed,
          caseCount: testCases.length,
          passedCount: caseResults.filter((r) => r.passed).length,
        },
      },
    });

    for (const cr of caseResults) {
      await tx.testCaseResult.upsert({
        where: {
          submissionId_testCaseId: {
            submissionId,
            testCaseId: cr.testCaseId,
          },
        },
        create: {
          submissionId,
          testCaseId: cr.testCaseId,
          passed: cr.passed,
          actualOutput: cr.actualOutput,
          executionTimeMs: cr.executionTimeMs,
          timedOut: cr.timedOut,
        },
        update: {
          passed: cr.passed,
          actualOutput: cr.actualOutput,
          executionTimeMs: cr.executionTimeMs,
          timedOut: cr.timedOut,
        },
      });
    }
  });

  await recomputeAttemptScore(attemptId);

  console.log(`[Judge] Submission ${submissionId} done: ${status}, score=${score}/${totalWeight}`);
}

async function recomputeAttemptScore(attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      submissions: true,
      test: { select: { config: true } },
    },
  });
  if (!attempt) return;

  const config = (attempt.test.config ?? {}) as {
    scoreDistribution?: string;
    questionWeights?: Record<string, number>;
  };

  const maxScore = attempt.submissions.reduce((sum, s) => {
    if (config.scoreDistribution === 'custom' && config.questionWeights?.[s.questionId] !== undefined) {
      return sum + Math.max(0, Number(config.questionWeights[s.questionId]));
    }
    return sum + 1;
  }, 0);

  const totalScore = attempt.submissions.reduce((sum, s) => {
    const weight = config.scoreDistribution === 'custom' && config.questionWeights?.[s.questionId] !== undefined
      ? Math.max(0, Number(config.questionWeights[s.questionId]))
      : 1;
    const actual = Math.max(0, Math.min(weight, Number.isFinite(s.score as number) ? Number(s.score) : 0));
    return sum + actual;
  }, 0);

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { score: totalScore, maxScore },
  });
}

const redisConnection = (() => {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
})();

const worker = new Worker('judge', processSubmission, {
  connection: redisConnection,
  concurrency: 2,
  limiter: { max: 5, duration: 1000 },
});

worker.on('completed', (job) => {
  console.log(`[Judge] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Judge] Job ${job?.id} failed:`, err.message);
});

console.log('[Judge] Worker started, listening for jobs on queue "judge"');

process.on('SIGTERM', async () => {
  console.log('[Judge] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

export { recomputeAttemptScore };
