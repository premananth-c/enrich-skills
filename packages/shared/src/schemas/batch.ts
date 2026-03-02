import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateBatchSchema = createBatchSchema.partial();

export const addBatchMemberSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type AddBatchMemberInput = z.infer<typeof addBatchMemberSchema>;
