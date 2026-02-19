import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2),
  tenantId: z.string().uuid().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const registerWithInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
});

export const createInviteSchema = z.object({
  email: z.string().email(),
  testId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterWithInviteInput = z.infer<typeof registerWithInviteSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
