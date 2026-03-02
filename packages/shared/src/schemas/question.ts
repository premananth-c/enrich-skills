import { z } from 'zod';

export const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isPublic: z.boolean(),
  weight: z.number().min(0).max(100),
});

export const createCodingQuestionSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(10),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string()).default([]),
  examples: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })).optional(),
  constraints: z.array(z.string()).optional(),
  testCases: z.array(testCaseSchema).min(1),
});

export const createMcqQuestionSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string()).default([]),
  options: z.array(z.object({
    text: z.string(),
    isCorrect: z.boolean(),
  })).min(2),
  explanation: z.string().optional(),
});

export const updateCodingQuestionSchema = createCodingQuestionSchema.partial();
export const updateMcqQuestionSchema = createMcqQuestionSchema.partial();

export type CreateCodingQuestionInput = z.infer<typeof createCodingQuestionSchema>;
export type CreateMcqQuestionInput = z.infer<typeof createMcqQuestionSchema>;
export type UpdateCodingQuestionInput = z.infer<typeof updateCodingQuestionSchema>;
export type UpdateMcqQuestionInput = z.infer<typeof updateMcqQuestionSchema>;
