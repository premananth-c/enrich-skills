import { z } from 'zod';

const scheduleEventBaseSchema = z.object({
  title: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  type: z.string().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  location: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const createScheduleEventSchema = scheduleEventBaseSchema.refine((d) => d.endAt > d.startAt, { message: 'endAt must be after startAt', path: ['endAt'] });

export const updateScheduleEventSchema = scheduleEventBaseSchema.partial();

export const createSchedulerNoteSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  content: z.string().min(1),
});

export const updateSchedulerNoteSchema = z.object({
  content: z.string().min(1),
});

export const createBatchVideoSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

export const updateBatchVideoSchema = createBatchVideoSchema.partial();

export type CreateScheduleEventInput = z.infer<typeof createScheduleEventSchema>;
export type UpdateScheduleEventInput = z.infer<typeof updateScheduleEventSchema>;
export type CreateSchedulerNoteInput = z.infer<typeof createSchedulerNoteSchema>;
export type UpdateSchedulerNoteInput = z.infer<typeof updateSchedulerNoteSchema>;
export type CreateBatchVideoInput = z.infer<typeof createBatchVideoSchema>;
export type UpdateBatchVideoInput = z.infer<typeof updateBatchVideoSchema>;
