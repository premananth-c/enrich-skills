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
