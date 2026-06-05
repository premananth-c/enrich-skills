import { Worker, Job, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  aiReviewPayloadSchema,
  computeQuestionTimings,
  formatDuration,
  timingByQuestionId,
} from '@enrich-skills/shared';
import { openRouterChatWithFallback } from './openrouter.js';
import {
  maybeScheduleAttemptOverallReview,
  processAttemptOverallReview,
} from './aiAttemptReviewer.js';
import { processCareerReview } from './aiCareerReviewer.js';

const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const MAX_CODE_CHARS = 12_000;

interface AiReviewJobData {
  submissionId: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n// ... truncated for review ...';
}

function buildPrompt(
  language: string,
  question: { content: unknown; difficulty?: string },
  code: string,
  testCases: { input: string; expectedOutput: string }[],
  timeSpentSeconds: number | null
): { system: string; user: string } {
  const content = question.content as { title?: string; description?: string };
  const title = content.title ?? 'Coding question';
  const description = content.description ?? '';
  const casesText =
    testCases.length > 0
      ? testCases
          .map((tc, i) => `Sample ${i + 1}:\n  Input: ${tc.input}\n  Expected: ${tc.expectedOutput}`)
          .join('\n')
      : 'No public sample cases.';

  const timeLine =
    timeSpentSeconds != null
      ? `Time spent on this question before final submission: ${formatDuration(timeSpentSeconds)} (${timeSpentSeconds}s). Briefly comment on whether this timing seems reasonable for the difficulty (${question.difficulty ?? 'unknown'}).`
      : 'Time spent on this question: not recorded.';

  const system = `You are a senior ${language} engineer reviewing student code for an online assessment.
Evaluate code quality, idiomatic use of ${language}, readability, efficiency, and style — not only whether tests might pass.
If timing data is provided, weave a short timing observation into overallSummary.
Respond with a single JSON object only (no markdown fences) matching this schema:
{
  "language": string (must be "${language}"),
  "overallSummary": string (2-4 sentences),
  "strengths": string[] (2-5 specific strengths),
  "weaknesses": string[] (2-5 specific areas to improve),
  "recommendations": string[] (3-6 actionable learning steps),
  "scores": {
    "correctness": number 1-5,
    "readability": number 1-5,
    "efficiency": number 1-5,
    "style": number 1-5
  }
}`;

  const user = `Question: ${title}
${description ? `Description:\n${description}\n` : ''}
Language: ${language}
${timeLine}

Public test cases:
${casesText}

Student submission:
\`\`\`${language}
${truncate(code, MAX_CODE_CHARS)}
\`\`\``;

  return { system, user };
}

async function processAiReview(job: Job<AiReviewJobData>) {
  const { submissionId } = job.data;
  console.log(`[AI Review] Processing submission ${submissionId}`);

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      question: { include: { testCases: { where: { isPublic: true } } } },
      attempt: {
        select: {
          startedAt: true,
          submissions: {
            select: {
              questionId: true,
              code: true,
              codeSubmittedAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!submission) {
    console.warn(`[AI Review] Submission ${submissionId} not found`);
    return;
  }

  if (!submission.code?.trim()) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { aiReviewStatus: 'skipped', aiReviewError: null },
    });
    return;
  }

  if (submission.question.type !== 'coding') {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { aiReviewStatus: 'skipped', aiReviewError: null },
    });
    return;
  }

  const language = submission.language ?? 'python';

  await prisma.submission.update({
    where: { id: submissionId },
    data: { aiReviewStatus: 'generating', aiReviewError: null },
  });

  try {
    const timingMap = timingByQuestionId(
      computeQuestionTimings(submission.attempt.startedAt, submission.attempt.submissions)
    );
    const timeSpentSeconds = timingMap.get(submission.questionId) ?? null;

    const { system, user } = buildPrompt(
      language,
      submission.question,
      submission.code,
      submission.question.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
      timeSpentSeconds
    );

    const { content, model } = await openRouterChatWithFallback({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 900,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI response was not valid JSON');
    }

    const validated = aiReviewPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`AI response schema invalid: ${validated.error.message.slice(0, 300)}`);
    }

    const report = { ...validated.data, language };

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        aiReview: report,
        aiReviewStatus: 'ready',
        aiReviewError: null,
        aiReviewModel: model,
        aiReviewLanguage: language,
        aiReviewGeneratedAt: new Date(),
      },
    });

    console.log(`[AI Review] Submission ${submissionId} ready (model=${model})`);

    const attemptId = submission.attemptId;
    await maybeScheduleAttemptOverallReview(attemptId, aiReviewQueue);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isLastAttempt = (job.opts.attempts ?? 1) <= job.attemptsMade;

    if (isLastAttempt) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          aiReviewStatus: 'failed',
          aiReviewError: message.slice(0, 500),
        },
      });
      console.error(`[AI Review] Submission ${submissionId} failed:`, message);
    }
    throw err;
  }
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

const aiReviewQueue = new Queue('ai-review', { connection: redisConnection });

const worker = new Worker(
  'ai-review',
  async (job: Job) => {
    if (job.name === 'attempt-review') {
      return processAttemptOverallReview(job as Job<{ attemptId: string }>);
    }
    if (job.name === 'career-review') {
      return processCareerReview(job as Job<{ userId: string }>);
    }
    return processAiReview(job as Job<AiReviewJobData>);
  },
  {
    connection: redisConnection,
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
  }
);

worker.on('completed', (job) => {
  console.log(`[AI Review] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[AI Review] Job ${job?.id} failed:`, err.message);
});

console.log('[AI Review] Worker started, listening on queue "ai-review"');

process.on('SIGTERM', async () => {
  await worker.close();
});
