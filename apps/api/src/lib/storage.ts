import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
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

function ensureR2Config(): void {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in the environment.'
    );
  }
}

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

/**
 * Build an R2 object key from category + context. Used for chunked video uploads
 * where the key is generated before the upload begins.
 */
export function buildStorageKey(
  category: string,
  filename: string,
  mimeType: string | undefined,
  context: UploadContext = {}
): string {
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
  return keyParts.join('/');
}

export async function initiateMultipartUpload(
  key: string,
  mimeType: string
): Promise<string> {
  ensureR2Config();
  const result = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
    })
  );
  return result.UploadId!;
}

export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  ensureR2Config();
  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<void> {
  ensureR2Config();
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    })
  );
}

export interface RangeStreamResult {
  stream: NodeJS.ReadableStream;
  contentLength: number;
  contentRange: string | undefined;
  contentType: string;
  totalSize: number;
  statusCode: 200 | 206;
}

/**
 * Stream a file from R2 with optional byte-range support for video seeking.
 */
export async function getFileStreamWithRange(
  storageKey: string,
  rangeHeader?: string
): Promise<RangeStreamResult | null> {
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey })
    );
    const totalSize = head.ContentLength ?? 0;
    const contentType = head.ContentType ?? 'application/octet-stream';

    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
        const range = `bytes=${start}-${end}`;
        const response = await s3.send(
          new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey, Range: range })
        );
        return {
          stream: response.Body as NodeJS.ReadableStream,
          contentLength: end - start + 1,
          contentRange: `bytes ${start}-${end}/${totalSize}`,
          contentType,
          totalSize,
          statusCode: 206,
        };
      }
    }

    const response = await s3.send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: storageKey })
    );
    return {
      stream: response.Body as NodeJS.ReadableStream,
      contentLength: totalSize,
      contentRange: undefined,
      contentType,
      totalSize,
      statusCode: 200,
    };
  } catch {
    return null;
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
  RECORDINGS: 'recordings',
} as const;
