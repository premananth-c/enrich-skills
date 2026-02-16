import { z } from 'zod';

export const supportedLanguages = ['python', 'java', 'cpp', 'javascript'] as const;

export const submitCodeSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string(),
  language: z.enum(supportedLanguages),
});

export const submitMcqSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
});

export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;
