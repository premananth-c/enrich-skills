import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'rankership';
/** Optional: public CDN / R2 custom domain URL (e.g. https://assets.yourdomain.com) */
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? '';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Optional context fields used to build an organised key path inside the bucket.
 *
 * Bucket layout:
 *   materials/{tenantId}/{courseId}/{topicId}/{uuid}.{ext}   — PDFs, images, docs
 *   videos/{tenantId}/{batchId}/{uuid}.{ext}                 — meeting recordings, video files
 *   submissions/{tenantId}/{activityId}/{userId}/{uuid}.{ext} — student assignment uploads
 */
export interface UploadContext {
  tenantId?: string;
  courseId?: string;
  topicId?: string;
  batchId?: string;
  activityId?: string;
  userId?: string;
}

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns the object key (stored in DB as `storageKey`).
 */
export async function saveFile(
  category: string,
  filename: string,
  buffer: Buffer,
  mimeType?: string,
  context: UploadContext = {}
): Promise<string> {
  const ext = path.extname(filename) || deriveExt(mimeType);
  const uuid = randomUUID();

  const keyParts: string[] = [category];
  if (context.tenantId) keyParts.push(context.tenantId);
  if (context.courseId) keyParts.push(context.courseId);
  if (context.topicId) keyParts.push(context.topicId);
  if (context.batchId) keyParts.push(context.batchId);
  if (context.activityId) keyParts.push(context.activityId);
  if (context.userId) keyParts.push(context.userId);
  keyParts.push(`${uuid}${ext}`);

  const key = keyParts.join('/');

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimeType ?? 'application/octet-stream',
    })
  );

  return key;
}

/**
 * Generate a presigned download URL for the given storage key.
 * - If `R2_PUBLIC_URL` is set the file is served directly via the CDN/custom domain.
 * - Otherwise a short-lived presigned URL (default 1 hour) is returned.
 * Returns `null` when the key is empty/missing.
 */
export async function getFileUrl(
  storageKey: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!storageKey) return null;

  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${storageKey}`;
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Stream a file directly from R2.
 * Returns a Node.js readable stream, or `null` when the object is not found.
 */
export async function getFileStream(
  storageKey: string
): Promise<NodeJS.ReadableStream | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey })
    );
    return response.Body as NodeJS.ReadableStream;
  } catch {
    return null;
  }
}

/**
 * Delete an object from R2 by its storage key.
 */
export async function deleteFile(storageKey: string): Promise<boolean> {
  try {
    await s3.send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey })
    );
    return true;
  } catch {
    return false;
  }
}

function deriveExt(mimeType?: string): string {
  if (!mimeType) return '.bin';
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/zip': '.zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
  };
  return map[mimeType] ?? '.bin';
}

export const STORAGE_KEYS = {
  MATERIALS: 'materials',
  VIDEOS: 'videos',
  SUBMISSIONS: 'submissions',
} as const;
