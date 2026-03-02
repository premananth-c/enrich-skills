import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

export async function ensureUploadDir(subdir: string): Promise<string> {
  const dir = path.join(UPLOAD_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Save a file buffer to local storage. Returns a storage key (relative path) for DB.
 */
export async function saveFile(
  subdir: string,
  filename: string,
  buffer: Buffer,
  mimeType?: string
): Promise<string> {
  await ensureUploadDir(subdir);
  const ext = path.extname(filename) || (mimeType?.includes('pdf') ? '.pdf' : '.bin');
  const key = `${subdir}/${randomUUID()}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, key);
  await fs.writeFile(fullPath, buffer);
  return key;
}

/**
 * Get absolute path for a storage key. Returns null if file does not exist.
 */
export async function getFilePath(storageKey: string): Promise<string | null> {
  const fullPath = path.join(UPLOAD_DIR, storageKey);
  try {
    await fs.access(fullPath);
    return fullPath;
  } catch {
    return null;
  }
}

/**
 * Delete file by storage key.
 */
export async function deleteFile(storageKey: string): Promise<boolean> {
  const fullPath = path.join(UPLOAD_DIR, storageKey);
  try {
    await fs.unlink(fullPath);
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  MATERIALS: 'materials',
  VIDEOS: 'videos',
} as const;
