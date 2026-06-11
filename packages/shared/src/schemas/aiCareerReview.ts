import { z } from 'zod';

/** @deprecated Legacy per-test insight — v1 reports only */
export const aiCareerTestInsightSchema = z.object({
  testTitle: z.string(),
  languages: z.array(z.string()),
  scoreSummary: z.string(),
  highlights: z.string(),
});

export const competencyScoresSchema = z.object({
  logic: z.number().min(1).max(10),
  codeQuality: z.number().min(1).max(10),
  speed: z.number().min(1).max(10),
  languageVersatility: z.number().min(1).max(10),
});

export const languageProficiencySchema = z.object({
  language: z.string(),
  fluencyScore: z.number().min(1).max(10),
  proficiencyLevel: z.string(),
  idiomaticUsage: z.string(),
  paradigmNotes: z.string(),
});

export const languageAgilitySchema = z.object({
  versatilityScore: z.number().min(1).max(10),
  versatilityJustification: z.string(),
  paradigmEvaluation: z.string(),
  languageProficiency: z.array(languageProficiencySchema),
  coreCsConcepts: z.object({
    dataStructures: z.string(),
    algorithms: z.string(),
  }),
});

export const codeQualityIndustrySchema = z.object({
  readabilityAndMaintainability: z.string(),
  namingConventions: z.string(),
  modularity: z.string(),
  robustnessAndEdgeCases: z.string(),
  codeSmells: z.array(z.string()),
  bestPractices: z.string(),
});

export const problemEfficiencySchema = z.object({
  problemTitle: z.string(),
  language: z.string(),
  timeComplexity: z.string(),
  spaceComplexity: z.string(),
  optimizationGap: z.string(),
  optimizationScore: z.number().min(1).max(10),
});

export const algorithmicEfficiencySchema = z.object({
  summary: z.string(),
  problemAnalyses: z.array(problemEfficiencySchema),
});

export const behavioralPatternsSchema = z.object({
  debuggingEfficiency: z.string(),
  timeManagement: z.string(),
});

export const roleMappingSchema = z.object({
  role: z.string(),
  fitLevel: z.enum(['Strong', 'Moderate', 'Emerging']),
  rationale: z.string(),
});

export const industryFitmentSchema = z.object({
  employabilityTag: z.string(),
  roleMappings: z.array(roleMappingSchema),
  skillGapAnalysis: z.string(),
});

export const weekRoadmapSchema = z.object({
  week: z.number().int().min(1).max(4),
  focus: z.string(),
  tasks: z.array(z.string()).min(1),
});

/** Industry-ready career report (v2) */
export const aiCareerReviewPayloadSchema = z.object({
  executiveSummary: z.string(),
  competencyScores: competencyScoresSchema,
  languageAgility: languageAgilitySchema,
  codeQuality: codeQualityIndustrySchema,
  algorithmicEfficiency: algorithmicEfficiencySchema,
  behavioralPatterns: behavioralPatternsSchema,
  industryFitment: industryFitmentSchema,
  fourWeekRoadmap: z.array(weekRoadmapSchema).min(1).max(4),
  testsAnalyzed: z.number().int().min(0),
});

/** Legacy v1 shape for reports generated before the industry-ready upgrade */
export const aiCareerReviewLegacySchema = z.object({
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
export type AiCareerReviewLegacy = z.infer<typeof aiCareerReviewLegacySchema>;

export function isIndustryCareerReport(
  report: unknown
): report is AiCareerReviewPayload {
  return aiCareerReviewPayloadSchema.safeParse(report).success;
}
