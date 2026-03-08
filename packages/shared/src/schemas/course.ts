import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateCourseSchema = createCourseSchema.partial();

export const createChapterSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().min(0).optional(),
});

export const updateChapterSchema = createChapterSchema.partial();

export const createTopicSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().min(0).optional(),
  content: z.string().optional(),
});

export const updateTopicSchema = createTopicSchema.partial();

export const createMaterialSchema = z.object({
  type: z.enum(['pdf', 'link', 'video']),
  title: z.string().min(1),
  url: z.string().url().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  sizeBytes: z.number().int().min(0).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const updateMaterialSchema = createMaterialSchema.partial();

export const createActivitySchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateActivitySchema = createActivitySchema.partial();

export const createEvaluationSchema = z.object({
  type: z.enum(['quiz', 'test', 'mcp']),
  title: z.string().min(1),
  testId: z.string().uuid().optional().nullable(),
  config: z.record(z.unknown()).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateEvaluationSchema = createEvaluationSchema.partial();

export const createCourseAssignmentSchema = z.object({
  courseId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
}).refine((d) => (d.batchId != null) !== (d.userId != null), {
  message: 'Exactly one of batchId or userId must be set',
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type CreateCourseAssignmentInput = z.infer<typeof createCourseAssignmentSchema>;
