import { Prisma, type PrismaClient } from '@prisma/client';
import { aiReviewQueue } from './aiReviewQueue.js';

type SubmissionRow = {
  id: string;
  questionId: string;
  code: string | null;
  question: { type: string };
};

export async function enqueueAiReviewsForAttempt(
  prisma: PrismaClient,
  attemptId: string,
  submissions: SubmissionRow[]
): Promise<void> {
  const codingSubs = submissions.filter((s) => s.question.type === 'coding');

  for (const sub of codingSubs) {
    if (sub.code?.trim()) {
      await prisma.submission.update({
        where: { id: sub.id },
        data: { aiReviewStatus: 'queued', aiReviewError: null },
      });
      await aiReviewQueue.add('review', { submissionId: sub.id });
    } else {
      await prisma.submission.update({
        where: { id: sub.id },
        data: { aiReviewStatus: 'skipped', aiReviewError: null },
      });
    }
  }
}

export async function enqueueAiReviewRegenerate(
  prisma: PrismaClient,
  submissionIds: string[]
): Promise<number> {
  let count = 0;
  for (const submissionId of submissionIds) {
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { question: { select: { type: true } } },
    });
    if (!sub || sub.question.type !== 'coding' || !sub.code?.trim()) continue;

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        aiReviewStatus: 'queued',
        aiReviewError: null,
        aiReview: Prisma.JsonNull,
        aiReviewModel: null,
        aiReviewLanguage: null,
        aiReviewGeneratedAt: null,
      },
    });
    await aiReviewQueue.add('review', { submissionId });
    count++;
  }
  return count;
}

export function serializeAiReviewSubmission(sub: {
  questionId: string;
  aiReviewStatus: string | null;
  aiReview: unknown;
  aiReviewError: string | null;
  aiReviewModel: string | null;
  aiReviewLanguage: string | null;
  aiReviewGeneratedAt: Date | null;
}) {
  return {
    questionId: sub.questionId,
    status: sub.aiReviewStatus,
    report: sub.aiReviewStatus === 'ready' ? sub.aiReview : null,
    error: sub.aiReviewError,
    model: sub.aiReviewModel,
    language: sub.aiReviewLanguage,
    generatedAt: sub.aiReviewGeneratedAt,
  };
}

export function serializeAttemptOverallReview(attempt: {
  aiOverallReviewStatus: string | null;
  aiOverallReview: unknown;
  aiOverallReviewError: string | null;
  aiOverallReviewModel: string | null;
  aiOverallReviewGeneratedAt: Date | null;
}) {
  return {
    status: attempt.aiOverallReviewStatus,
    report: attempt.aiOverallReviewStatus === 'ready' ? attempt.aiOverallReview : null,
    error: attempt.aiOverallReviewError,
    model: attempt.aiOverallReviewModel,
    generatedAt: attempt.aiOverallReviewGeneratedAt,
  };
}

const ATTEMPT_REVIEW_JOB_ID = (attemptId: string) => `attempt-review-${attemptId}`;

export async function enqueueAttemptOverallReview(
  prisma: PrismaClient,
  attemptId: string,
  opts?: { delayMs?: number; force?: boolean }
): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      aiOverallReviewStatus: true,
      test: { select: { type: true, config: true } },
      submissions: {
        where: { question: { type: 'coding' } },
        select: { code: true },
      },
    },
  });
  if (!attempt) return;

  const config = attempt.test.config as { aiFeedbackEnabled?: boolean };
  if (!config.aiFeedbackEnabled || attempt.test.type !== 'coding') return;

  const hasCode = attempt.submissions.some((s) => s.code?.trim());
  if (!hasCode) {
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { aiOverallReviewStatus: 'skipped', aiOverallReviewError: null },
    });
    return;
  }

  if (
    !opts?.force &&
    (attempt.aiOverallReviewStatus === 'ready' || attempt.aiOverallReviewStatus === 'generating')
  ) {
    return;
  }

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      aiOverallReviewStatus: 'queued',
      aiOverallReviewError: null,
      ...(opts?.force
        ? {
            aiOverallReview: Prisma.JsonNull,
            aiOverallReviewModel: null,
            aiOverallReviewGeneratedAt: null,
          }
        : {}),
    },
  });

  await aiReviewQueue.add(
    'attempt-review',
    { attemptId },
    {
      jobId: ATTEMPT_REVIEW_JOB_ID(attemptId),
      delay: opts?.delayMs ?? 45_000,
      attempts: 10,
      backoff: { type: 'exponential', delay: 12_000 },
    }
  );
}

export async function enqueueAttemptOverallReviewRegenerate(
  prisma: PrismaClient,
  attemptId: string
): Promise<boolean> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { type: true, config: true } },
      submissions: {
        where: { question: { type: 'coding' } },
        select: { code: true },
      },
    },
  });
  if (!attempt) return false;

  const config = attempt.test.config as { aiFeedbackEnabled?: boolean };
  if (!config.aiFeedbackEnabled || attempt.test.type !== 'coding') return false;
  if (!attempt.submissions.some((s) => s.code?.trim())) return false;

  await enqueueAttemptOverallReview(prisma, attemptId, { force: true, delayMs: 0 });
  return true;
}
