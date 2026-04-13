import { z } from 'zod';

export const meetingTypeEnum = z.enum(['interactive_meeting', 'webinar']);

export const interactiveMeetingConfigSchema = z.object({
  participantVideoDefaultOn: z.boolean().default(true),
  participantAudioDefaultOn: z.boolean().default(true),
  allowParticipantScreenShare: z.boolean().default(false),
  chatMode: z.enum(['admin_only', 'everyone']).default('everyone'),
});

export const webinarConfigSchema = z.object({
  chatMode: z.enum(['admin_only', 'everyone', 'off']).default('everyone'),
});

export const createMeetingSchema = z.object({
  name: z.string().min(1).max(200),
  type: meetingTypeEnum,
  maxParticipants: z.number().int().min(2).max(10000),
  batchId: z.string().uuid().optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  coHostUserIds: z.array(z.string().uuid()).default([]),
  config: z.union([interactiveMeetingConfigSchema, webinarConfigSchema]).optional(),
});

export const updateMeetingSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['scheduled', 'live', 'ended']).optional(),
  config: z.union([interactiveMeetingConfigSchema, webinarConfigSchema]).optional(),
  coHostUserIds: z.array(z.string().uuid()).optional(),
});

export const sendMeetingInviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(200),
});

export type MeetingType = z.infer<typeof meetingTypeEnum>;
export type InteractiveMeetingConfig = z.infer<typeof interactiveMeetingConfigSchema>;
export type WebinarConfig = z.infer<typeof webinarConfigSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type SendMeetingInviteInput = z.infer<typeof sendMeetingInviteSchema>;
