export interface LiveMeeting {
  id: string;
  tenantId: string;
  batchId: string | null;
  name: string;
  type: 'interactive_meeting' | 'webinar';
  maxParticipants: number;
  provider: string;
  providerRoomId: string | null;
  providerRoomUrl: string | null;
  config: Record<string, unknown>;
  hostUserId: string;
  coHostUserIds: string[];
  status: 'scheduled' | 'live' | 'ended';
  scheduledAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  host?: { id: string; name: string; email: string | null };
  batch?: { id: string; name: string } | null;
}

export interface LiveMeetingRecording {
  id: string;
  liveMeetingId: string;
  providerRecordingId: string | null;
  storageKey: string | null;
  playbackUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
}
