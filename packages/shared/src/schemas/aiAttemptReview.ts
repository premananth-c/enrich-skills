import { z } from 'zod';

export const aiAttemptTopicInsightSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  trend: z.string().optional(),
});

export const aiAttemptReviewPayloadSchema = z.object({
  overallSummary: z.string(),
  performanceTrend: z.string(),
  topicInsights: z.array(aiAttemptTopicInsightSchema),
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type AiAttemptReviewPayload = z.infer<typeof aiAttemptReviewPayloadSchema>;
export type AiAttemptTopicInsight = z.infer<typeof aiAttemptTopicInsightSchema>;
