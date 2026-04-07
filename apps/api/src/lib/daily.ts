const DAILY_API_KEY = process.env.DAILY_API_KEY || '';
const DAILY_BASE_URL = process.env.DAILY_BASE_URL || 'https://api.daily.co/v1';

interface DailyRoomProperties {
  max_participants?: number;
  enable_chat?: boolean;
  start_video_off?: boolean;
  start_audio_off?: boolean;
  owner_only_broadcast?: boolean;
  enable_screenshare?: boolean;
  exp?: number;
}

interface DailyRoom {
  id: string;
  name: string;
  url: string;
  privacy: string;
  config: DailyRoomProperties;
  created_at: string;
}

interface DailyMeetingToken {
  token: string;
}

async function dailyFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${DAILY_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Daily API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface CreateRoomOptions {
  name: string;
  maxParticipants: number;
  isWebinar: boolean;
  startVideoOff: boolean;
  startAudioOff: boolean;
  enableScreenShare: boolean;
  enableChat: boolean;
  expiresAt?: Date;
}

export async function createRoom(opts: CreateRoomOptions): Promise<DailyRoom> {
  const properties: DailyRoomProperties = {
    max_participants: opts.maxParticipants,
    enable_chat: opts.enableChat,
    start_video_off: opts.startVideoOff,
    start_audio_off: opts.startAudioOff,
    owner_only_broadcast: opts.isWebinar,
    enable_screenshare: opts.enableScreenShare,
  };
  if (opts.expiresAt) {
    properties.exp = Math.floor(opts.expiresAt.getTime() / 1000);
  }
  return dailyFetch<DailyRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      privacy: 'private',
      properties,
    }),
  });
}

export async function deleteRoom(roomName: string): Promise<void> {
  await dailyFetch(`/rooms/${roomName}`, { method: 'DELETE' });
}

export interface CreateTokenOptions {
  roomName: string;
  userId: string;
  userName: string;
  isOwner: boolean;
  expiresInSeconds?: number;
}

export async function createMeetingToken(opts: CreateTokenOptions): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + (opts.expiresInSeconds ?? 3600);
  const result = await dailyFetch<DailyMeetingToken>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        user_id: opts.userId,
        user_name: opts.userName,
        is_owner: opts.isOwner,
        exp,
      },
    }),
  });
  return result.token;
}

export function isDailyConfigured(): boolean {
  return Boolean(DAILY_API_KEY);
}
