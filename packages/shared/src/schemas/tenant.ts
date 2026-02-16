import { z } from 'zod';

export const brandingConfigSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().optional(),
  customCss: z.string().optional(),
});

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  domain: z.string().optional(),
  brandingConfig: brandingConfigSchema.optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
