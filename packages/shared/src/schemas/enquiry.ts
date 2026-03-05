import { z } from 'zod';
import { safeTextRefine, SAFE_TEXT_REFINEMENT_MSG } from '../lib/sanitize.js';

const ENQUIRY_CATEGORIES = ['student', 'college', 'corporate', 'academic'] as const;

export const createEnquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters')
    .refine(safeTextRefine, SAFE_TEXT_REFINEMENT_MSG),
  email: z.string().trim().email('Invalid email address'),
  phone: z
    .string()
    .trim()
    .min(10, 'Phone must be at least 10 characters')
    .max(20, 'Phone must be at most 20 characters')
    .regex(/^[0-9+\-().\s]+$/, 'Phone can only contain digits, spaces, +, -, parentheses, and periods'),
  category: z.enum(ENQUIRY_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(2000, 'Message must be at most 2000 characters')
    .refine(safeTextRefine, SAFE_TEXT_REFINEMENT_MSG),
});

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'closed']),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type UpdateEnquiryStatusInput = z.infer<typeof updateEnquiryStatusSchema>;
export type EnquiryCategory = (typeof ENQUIRY_CATEGORIES)[number];
