import { Job, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  aiAttemptReviewPayloadSchema,
  computeQuestionTimings,
  computeTotalTestSeconds,
  formatDuration,
  primaryTopic,
  timingByQuestionId,
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
  totalTestSeconds: number | null,
  questions: Array<{
    title: string;
    topic: string;
    difficulty: string;
    submissionStatus: string;
    score: number | null;
    timeSpentSeconds: number | null;
    aiReview: AiReviewPayload | null;
    aiReviewStatus: string | null;
  }>,
  languages: string[]
): { system: string; user: string } {
  const scoreLine =
    score != null && maxScore != null && maxScore > 0
      ? `Score: ${score} / ${maxScore} (${Math.round((score / maxScore) * 100)}%)`
      : 'Score: not available';

  const totalTimeLine =
    totalTestSeconds != null
      ? `Total test time: ${formatDuration(totalTestSeconds)} (${totalTestSeconds}s)`
      : 'Total test time: not available';

  const questionBlocks = questions
    .map((q, i) => {
      const review = q.aiReview;
      const timeLine =
        q.timeSpentSeconds != null
          ? `Time on question: ${formatDuration(q.timeSpentSeconds)} (${q.timeSpentSeconds}s)`
          : 'Time on question: not recorded';
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
${timeLine}
${reviewBlock}`;
    })
    .join('\n\n');

  const system = `You are a senior engineering mentor writing a consolidated performance report for a coding assessment.
Use per-question results, timing, and AI reviews. Group insights by topic/tag.
Comment on time management — especially if easy questions took disproportionately long.
Include job-readiness learning paths based on languages used: ${languages.join(', ') || 'unknown'}.
Respond with a single JSON object only (no markdown fences) matching this schema:
{
  "overallSummary": string (3-5 sentences),
  "performanceTrend": string (1-3 sentences),
  "topicInsights": [{ "topic": string, "summary": string, "strengths": string[], "weaknesses": string[], "trend": string }],
  "overallStrengths": string[] (3-6),
  "overallWeaknesses": string[] (3-6),
  "improvementAreas": string[] (3-6 skill gaps),
  "additionalLearning": string[] (4-8 topics/courses/projects for employability in current market),
  "jobReadinessNote": string (2-4 sentences on job market fit for their language stack),
  "timeAnalysis": {
    "totalTimeSeconds": number (use provided total),
    "summary": string (time management assessment),
    "observations": string[] (2-5, note easy vs hard question timing)
  },
  "recommendations": string[] (4-8 actionable next steps)
}`;

  const user = `Test: ${testTitle}
${scoreLine}
${totalTimeLine}
Languages: ${languages.join(', ') || '—'}

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
    const timingMap = timingByQuestionId(
      computeQuestionTimings(attempt.startedAt, codingSubs)
    );
    const totalTestSeconds = computeTotalTestSeconds(attempt.startedAt, attempt.submittedAt);
    const languages = [
      ...new Set(codingSubs.map((s) => s.language).filter((l): l is string => Boolean(l))),
    ];

    const questions = codingSubs.map((s) => {
      const content = s.question.content as { title?: string };
      return {
        title: content.title ?? 'Coding question',
        topic: primaryTopic(s.question.tags),
        difficulty: s.question.difficulty,
        submissionStatus: s.status,
        score: s.score,
        timeSpentSeconds: timingMap.get(s.questionId) ?? null,
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
      totalTestSeconds,
      questions,
      languages
    );

    const { content, model } = await openRouterChatWithFallback({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      jsonMode: true,
      temperature: 0.25,
      maxTokens: 1800,
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

    const report = {
      ...validated.data,
      timeAnalysis: {
        ...validated.data.timeAnalysis,
        totalTimeSeconds: totalTestSeconds ?? validated.data.timeAnalysis.totalTimeSeconds,
      },
    };

    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        aiOverallReview: report,
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
