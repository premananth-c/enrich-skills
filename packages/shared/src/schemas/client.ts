import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isArchived: z.boolean().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
