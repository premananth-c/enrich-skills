import { z } from 'zod';

export const proctoringConfigSchema = z.object({
  mode: z.enum(['live', 'webcam', 'both']),
  identityCheckRequired: z.boolean(),
  cameraMandatory: z.boolean(),
  micRequired: z.boolean(),
  retentionDays: z.number().min(0).max(365),
});

export const testConfigSchema = z.object({
  durationMinutes: z.number().min(1).max(480),
  attemptLimit: z.number().min(1).max(100),
  shuffleQuestions: z.boolean(),
  showResultsImmediately: z.boolean(),
  partialScoring: z.boolean(),
  proctoringEnabled: z.boolean(),
  proctoringConfig: proctoringConfigSchema.optional(),
  aiFeedbackEnabled: z.boolean(),
});

export const testScheduleSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
});

export const createTestSchema = z.object({
  title: z.string().min(2),
  type: z.enum(['coding', 'mcq']),
  config: testConfigSchema,
  schedule: testScheduleSchema.optional(),
  questionIds: z.array(z.string().uuid()).optional(),
});

export const updateTestSchema = createTestSchema.partial();

export type CreateTestInput = z.infer<typeof createTestSchema>;
