import { z } from 'zod';
import { CODING_LANGUAGE_IDS } from '../lib/codingLanguages.js';

export const supportedLanguages = CODING_LANGUAGE_IDS;

export const submitCodeSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string(),
  language: z.enum(supportedLanguages),
});

export const runCodeSchema = z.object({
  questionId: z.string().uuid(),
  code: z.string(),
  language: z.enum(supportedLanguages),
});

export const submitMcqSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
});

export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;
export type RunCodeInput = z.infer<typeof runCodeSchema>;
