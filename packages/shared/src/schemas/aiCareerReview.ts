import { z } from 'zod';

export const aiCareerTestInsightSchema = z.object({
  testTitle: z.string(),
  languages: z.array(z.string()),
  scoreSummary: z.string(),
  highlights: z.string(),
});

export const aiCareerReviewPayloadSchema = z.object({
  overallSummary: z.string(),
  languagesAndDomains: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvementAreas: z.array(z.string()),
  additionalLearning: z.array(z.string()),
  jobMarketOutlook: z.string(),
  testsAnalyzed: z.number().int().min(0),
  testInsights: z.array(aiCareerTestInsightSchema),
  recommendations: z.array(z.string()),
});

export type AiCareerReviewPayload = z.infer<typeof aiCareerReviewPayloadSchema>;
export type AiCareerTestInsight = z.infer<typeof aiCareerTestInsightSchema>;
