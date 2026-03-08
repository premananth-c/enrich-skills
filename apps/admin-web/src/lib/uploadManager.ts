/**
 * Global video upload manager. Runs uploads in the background so they
 * survive page navigation. Emits events that any component can subscribe to.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'enrich_admin_token';
const TENANT_KEY = 'enrich_tenant_id';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

export interface UploadTask {
  id: string;
  filename: string;
  progress: number;       // 0-100
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
  topicId: string;
}

type Listener = (tasks: UploadTask[]) => void;

const tasks: Map<string, UploadTask> = new Map();
const listeners: Set<Listener> = new Set();

function notify() {
  const snapshot = Array.from(tasks.values());
  for (const fn of listeners) fn(snapshot);
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(Array.from(tasks.values()));
  return () => listeners.delete(fn);
}

export function dismissTask(taskId: string) {
  tasks.delete(taskId);
  notify();
}

export function getActiveTasks(): UploadTask[] {
  return Array.from(tasks.values());
}

function authedHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const tenantId = localStorage.getItem(TENANT_KEY);
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  return headers;
}

async function apiCall<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: 'POST',
    headers: authedHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload request failed: ${res.status}`);
  }
  return res.json();
}

export async function startVideoUpload(
  courseId: string,
  chapterId: string,
  topicId: string,
  file: File,
  onComplete?: () => void,
) {
  const taskId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const task: UploadTask = {
    id: taskId,
    filename: file.name,
    progress: 0,
    status: 'uploading',
    topicId,
  };
  tasks.set(taskId, task);
  notify();

  const basePath = `/courses/${courseId}/chapters/${chapterId}/topics/${topicId}/materials/video`;

  try {
    const init = await apiCall<{ materialId: string; uploadId: string; key: string }>(
      `${basePath}/init-upload`,
      { filename: file.name, sizeBytes: file.size, mimeType: file.type },
    );

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const parts: { partNumber: number; etag: string }[] = [];

    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const { url } = await apiCall<{ url: string }>(
        `${basePath}/presign-part`,
        { uploadId: init.uploadId, key: init.key, partNumber },
      );

      const putRes = await fetch(url, { method: 'PUT', body: chunk });
      const etag = putRes.headers.get('ETag') ?? '';
      parts.push({ partNumber, etag });

      task.progress = Math.round((partNumber / totalParts) * 100);
      notify();
    }

    await apiCall(`${basePath}/complete-upload`, {
      materialId: init.materialId,
      uploadId: init.uploadId,
      key: init.key,
      parts,
    });

    task.status = 'completed';
    task.progress = 100;
    notify();
    onComplete?.();
  } catch (err) {
    task.status = 'failed';
    task.error = err instanceof Error ? err.message : 'Upload failed';
    notify();
  }
}
