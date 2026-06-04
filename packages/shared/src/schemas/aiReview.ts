import { z } from 'zod';

export const aiReviewScoresSchema = z.object({
  correctness: z.number().min(1).max(5),
  readability: z.number().min(1).max(5),
  efficiency: z.number().min(1).max(5),
  style: z.number().min(1).max(5),
});

export const aiReviewPayloadSchema = z.object({
  language: z.string(),
  overallSummary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  scores: aiReviewScoresSchema,
});

export type AiReviewPayload = z.infer<typeof aiReviewPayloadSchema>;
export type AiReviewScores = z.infer<typeof aiReviewScoresSchema>;

export const AI_REVIEW_STATUSES = ['queued', 'generating', 'ready', 'failed', 'skipped'] as const;
export type AiReviewStatus = (typeof AI_REVIEW_STATUSES)[number];
