import { Job, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  aiAttemptReviewPayloadSchema,
  primaryTopic,
  type AiReviewPayload,
} from '@enrich-skills/shared';
import { openRouterChatWithFallback } from './openrouter.js';

const prisma = new PrismaClient();

const TERMINAL_QUESTION_STATUSES = new Set(['ready', 'failed', 'skipped']);

interface AttemptReviewJobData {
  attemptId: string;
}

function buildAttemptReviewPrompt(
  testTitle: string,
  score: number | null,
  maxScore: number | null,
  questions: Array<{
    title: string;
    topic: string;
    difficulty: string;
    submissionStatus: string;
    score: number | null;
    aiReview: AiReviewPayload | null;
    aiReviewStatus: string | null;
  }>
): { system: string; user: string } {
  const scoreLine =
    score != null && maxScore != null && maxScore > 0
      ? `Score: ${score} / ${maxScore} (${Math.round((score / maxScore) * 100)}%)`
      : 'Score: not available';

  const questionBlocks = questions
    .map((q, i) => {
      const review = q.aiReview;
      const reviewBlock = review
        ? `Per-question AI review:
  Summary: ${review.overallSummary}
  Strengths: ${review.strengths.join('; ') || '—'}
  Weaknesses: ${review.weaknesses.join('; ') || '—'}
  Scores (1-5): correctness=${review.scores.correctness}, readability=${review.scores.readability}, efficiency=${review.scores.efficiency}, style=${review.scores.style}`
        : `Per-question AI review: ${q.aiReviewStatus ?? 'not available'}`;

      return `Q${i + 1} [Topic: ${q.topic}] [${q.difficulty}]
Title: ${q.title}
Result: ${q.submissionStatus}${q.score != null ? ` (score ${q.score})` : ''}
${reviewBlock}`;
    })
    .join('\n\n');

  const system = `You are a senior engineering mentor writing a consolidated performance report for a coding assessment.
Use the per-question results and AI reviews below. Group insights by topic/tag.
Respond with a single JSON object only (no markdown fences) matching this schema:
{
  "overallSummary": string (3-5 sentences on overall performance),
  "performanceTrend": string (1-3 sentences on patterns across the attempt),
  "topicInsights": [
    {
      "topic": string,
      "summary": string (2-3 sentences for this topic),
      "strengths": string[] (2-4 items),
      "weaknesses": string[] (2-4 items),
      "trend": string (optional, e.g. "strong", "mixed", "needs focus")
    }
  ],
  "overallStrengths": string[] (3-6 cross-topic strengths),
  "overallWeaknesses": string[] (3-6 cross-topic weaknesses),
  "recommendations": string[] (4-8 actionable next steps)
}`;

  const user = `Test: ${testTitle}
${scoreLine}

Questions:
${questionBlocks}`;

  return { system, user };
}

export async function processAttemptOverallReview(job: Job<AttemptReviewJobData>): Promise<void> {
  const { attemptId } = job.data;
  console.log(`[AI Attempt Review] Processing attempt ${attemptId}`);

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { title: true, type: true, config: true } },
      submissions: {
        include: {
          question: { select: { type: true, tags: true, content: true, difficulty: true } },
        },
      },
    },
  });

  if (!attempt) {
    console.warn(`[AI Attempt Review] Attempt ${attemptId} not found`);
    return;
  }

  const config = attempt.test.config as { aiFeedbackEnabled?: boolean };
  if (!config.aiFeedbackEnabled || attempt.test.type !== 'coding') {
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { aiOverallReviewStatus: 'skipped', aiOverallReviewError: null },
    });
    return;
  }

  const codingSubs = attempt.submissions.filter(
    (s) => s.question.type === 'coding' && s.code?.trim()
  );

  if (codingSubs.length === 0) {
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { aiOverallReviewStatus: 'skipped', aiOverallReviewError: null },
    });
    return;
  }

  const pending = codingSubs.some(
    (s) => !s.aiReviewStatus || !TERMINAL_QUESTION_STATUSES.has(s.aiReviewStatus)
  );
  if (pending) {
    throw new Error('QUESTION_REVIEWS_PENDING');
  }

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { aiOverallReviewStatus: 'generating', aiOverallReviewError: null },
  });

  try {
    const questions = codingSubs.map((s) => {
      const content = s.question.content as { title?: string };
      return {
        title: content.title ?? 'Coding question',
        topic: primaryTopic(s.question.tags),
        difficulty: s.question.difficulty,
        submissionStatus: s.status,
        score: s.score,
        aiReview:
          s.aiReviewStatus === 'ready' && s.aiReview
            ? (s.aiReview as AiReviewPayload)
            : null,
        aiReviewStatus: s.aiReviewStatus,
      };
    });

    const { system, user } = buildAttemptReviewPrompt(
      attempt.test.title,
      attempt.score,
      attempt.maxScore,
      questions
    );

    const { content, model } = await openRouterChatWithFallback({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      jsonMode: true,
      temperature: 0.25,
      maxTokens: 1400,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI response was not valid JSON');
    }

    const validated = aiAttemptReviewPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`AI response schema invalid: ${validated.error.message.slice(0, 300)}`);
    }

    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        aiOverallReview: validated.data,
        aiOverallReviewStatus: 'ready',
        aiOverallReviewError: null,
        aiOverallReviewModel: model,
        aiOverallReviewGeneratedAt: new Date(),
      },
    });

    console.log(`[AI Attempt Review] Attempt ${attemptId} ready (model=${model})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isLastAttempt = (job.opts.attempts ?? 1) <= job.attemptsMade;

    if (isLastAttempt) {
      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          aiOverallReviewStatus: 'failed',
          aiOverallReviewError: message.slice(0, 500),
        },
      });
      console.error(`[AI Attempt Review] Attempt ${attemptId} failed:`, message);
    }
    throw err;
  }
}

export async function maybeScheduleAttemptOverallReview(
  attemptId: string,
  queue: Queue
): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      aiOverallReviewStatus: true,
      test: { select: { type: true, config: true } },
      submissions: {
        where: { question: { type: 'coding' } },
        select: { code: true, aiReviewStatus: true },
      },
    },
  });
  if (!attempt) return;

  const config = attempt.test.config as { aiFeedbackEnabled?: boolean };
  if (!config.aiFeedbackEnabled || attempt.test.type !== 'coding') return;

  const codingWithCode = attempt.submissions.filter((s) => s.code?.trim());
  if (codingWithCode.length === 0) return;

  const allTerminal = codingWithCode.every(
    (s) => s.aiReviewStatus && TERMINAL_QUESTION_STATUSES.has(s.aiReviewStatus)
  );
  if (!allTerminal) return;

  if (
    attempt.aiOverallReviewStatus === 'ready' ||
    attempt.aiOverallReviewStatus === 'generating'
  ) {
    return;
  }

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { aiOverallReviewStatus: 'queued', aiOverallReviewError: null },
  });

  await queue.add(
    'attempt-review',
    { attemptId },
    { jobId: `attempt-review-${attemptId}`, delay: 3000 }
  );
}
