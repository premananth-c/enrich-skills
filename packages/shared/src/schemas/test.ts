import { z } from 'zod';
import { CODING_LANGUAGE_IDS } from '../lib/codingLanguages.js';

const codingLanguageEnum = z.enum(CODING_LANGUAGE_IDS);

export const proctoringConfigSchema = z.object({
  mode: z.enum(['live', 'webcam', 'both']),
  identityCheckRequired: z.boolean(),
  cameraMandatory: z.boolean(),
  micRequired: z.boolean(),
  retentionDays: z.number().min(0).max(365),
});

const testConfigSchemaInner = z.object({
  durationMinutes: z.number().min(1).max(480),
  attemptLimit: z.number().min(1).max(100),
  shuffleQuestions: z.boolean(),
  showResultsPerQuestion: z.boolean(),
  showResultsImmediately: z.boolean(),
  partialScoring: z.boolean(),
  proctoringEnabled: z.boolean(),
  proctoringConfig: proctoringConfigSchema.optional(),
  aiFeedbackEnabled: z.boolean(),
  passPercentage: z.number().min(0).max(100).default(40),
  scoreDistribution: z.enum(['equal', 'custom']).default('equal'),
  questionWeights: z.record(z.string(), z.number().min(0)).optional(),
  restrictBrowserDuringTest: z.boolean().default(false),
  /** Required for new coding tests; students only see coding questions for this language. */
  codingLanguage: codingLanguageEnum.optional(),
});

/** Legacy single-flag configs map `showResultsImmediately` to both per-question and final-score visibility. */
export const testConfigSchema = z.preprocess((data: unknown) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const o = data as Record<string, unknown>;
  if (o.showResultsPerQuestion === undefined && o.showResultsImmediately !== undefined) {
    const v = !!o.showResultsImmediately;
    return { ...o, showResultsPerQuestion: v, showResultsImmediately: v };
  }
  return data;
}, testConfigSchemaInner);

export const testScheduleSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

const createTestSchemaBase = z.object({
  title: z.string().min(2),
  type: z.enum(['coding', 'mcq']),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  config: testConfigSchema,
  schedule: testScheduleSchema.optional(),
  questionIds: z.array(z.string().uuid()).optional(),
});

export const createTestSchema = createTestSchemaBase.superRefine((data, ctx) => {
  if (data.type === 'coding' && !data.config.codingLanguage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Coding language is required for coding tests',
      path: ['config', 'codingLanguage'],
    });
  }
});

export const updateTestSchema = createTestSchemaBase.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export type CreateTestInput = z.infer<typeof createTestSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
