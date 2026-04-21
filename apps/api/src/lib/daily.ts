const DAILY_API_KEY = process.env.DAILY_API_KEY || '';
const DAILY_BASE_URL = process.env.DAILY_BASE_URL || 'https://api.daily.co/v1';

interface DailyRoomProperties {
  max_participants?: number;
  enable_chat?: boolean;
  start_video_off?: boolean;
  start_audio_off?: boolean;
  owner_only_broadcast?: boolean;
  enable_screenshare?: boolean;
  enable_recording?: string;
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
    enable_recording: 'cloud',
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

export interface DailyRecordingAccess {
  download_link: string;
}

export async function startRecording(roomName: string): Promise<void> {
  await dailyFetch(`/rooms/${roomName}/recordings/start`, {
    method: 'POST',
    body: JSON.stringify({ type: 'cloud' }),
  });
}

export async function stopRecording(roomName: string): Promise<void> {
  await dailyFetch(`/rooms/${roomName}/recordings/stop`, { method: 'POST' });
}

export async function getRecordingAccessLink(recordingId: string): Promise<string> {
  const result = await dailyFetch<DailyRecordingAccess>(`/recordings/${recordingId}/access-link`);
  return result.download_link;
}

export async function downloadRecordingBuffer(downloadUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to download recording: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'video/mp4';
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

export function isDailyConfigured(): boolean {
  return Boolean(DAILY_API_KEY);
}

export async function verifyDailyWebhook(payload: string, signature: string): Promise<boolean> {
  const secret = process.env.DAILY_WEBHOOK_SECRET || '';
  if (!secret) return true;
  const crypto = await import('node:crypto');
  const secretBuffer = Buffer.from(secret, 'base64');
  const hmac = crypto.createHmac('sha256', secretBuffer);
  hmac.update(payload);
  const expected = hmac.digest('base64');
  return expected === signature;
}
