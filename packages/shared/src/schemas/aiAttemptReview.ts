import { z } from 'zod';

export const aiAttemptTopicInsightSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  trend: z.string().optional(),
});

export const aiAttemptTimeAnalysisSchema = z.object({
  totalTimeSeconds: z.number(),
  summary: z.string(),
  observations: z.array(z.string()),
});

export const aiAttemptReviewPayloadSchema = z.object({
  overallSummary: z.string(),
  performanceTrend: z.string(),
  topicInsights: z.array(aiAttemptTopicInsightSchema),
  overallStrengths: z.array(z.string()),
  overallWeaknesses: z.array(z.string()),
  improvementAreas: z.array(z.string()),
  additionalLearning: z.array(z.string()),
  jobReadinessNote: z.string(),
  timeAnalysis: aiAttemptTimeAnalysisSchema,
  recommendations: z.array(z.string()),
});

export type AiAttemptReviewPayload = z.infer<typeof aiAttemptReviewPayloadSchema>;
export type AiAttemptTopicInsight = z.infer<typeof aiAttemptTopicInsightSchema>;
