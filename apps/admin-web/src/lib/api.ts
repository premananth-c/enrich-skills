import { emitToast } from './toast';

const TOKEN_KEY = 'enrich_admin_token';
const REFRESH_KEY = 'enrich_admin_refresh_token';
const TENANT_KEY = 'enrich_tenant_id';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

function getRefreshedToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function getHeaders(body?: BodyInit | null): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const tenantId = localStorage.getItem(TENANT_KEY);
  const headers: Record<string, string> = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(tenantId && { 'X-Tenant-Id': tenantId }),
  };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return headers;
}

function buildHeaders(token: string, body?: BodyInit | null): Record<string, string> {
  const tenantId = localStorage.getItem(TENANT_KEY);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(tenantId && { 'X-Tenant-Id': tenantId }),
  };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return headers;
}

function formatErrorMessage(err: unknown, status: number, fallbackPrefix: string): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object') {
    const errorValue = (err as { error?: unknown }).error;
    if (typeof errorValue === 'string' && errorValue.trim()) return errorValue;
    if (errorValue && typeof errorValue === 'object') {
      const flatten = errorValue as { fieldErrors?: Record<string, unknown>; formErrors?: unknown[] };
      const messages: string[] = [];
      if (Array.isArray(flatten.formErrors)) {
        for (const msg of flatten.formErrors) {
          if (typeof msg === 'string' && msg.trim()) messages.push(msg);
        }
      }
      if (flatten.fieldErrors && typeof flatten.fieldErrors === 'object') {
        for (const value of Object.values(flatten.fieldErrors)) {
          if (!Array.isArray(value)) continue;
          for (const msg of value) {
            if (typeof msg === 'string' && msg.trim()) messages.push(msg);
          }
        }
      }
      if (messages.length > 0) return messages.join(', ');
    }
  }
  return `${fallbackPrefix}: ${status}`;
}

async function handleUnauthorized<T>(
  path: string,
  options: RequestInit,
  body: BodyInit | null | undefined
): Promise<Response | null> {
  const newToken = await getRefreshedToken();
  if (newToken) {
    const retryHeaders = { ...buildHeaders(newToken, body), ...options.headers };
    return fetch(`/api/v1${path}`, { ...options, headers: retryHeaders, body });
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('enrich_admin_user');
  window.location.href = '/login';
  return null;
}

function getSuccessMessage(method: string): string {
  if (method === 'POST') return 'Submitted successfully';
  if (method === 'PUT' || method === 'PATCH') return 'Updated successfully';
  if (method === 'DELETE') return 'Deleted successfully';
  return 'Action completed';
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = options.body;
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = method !== 'GET';
  const headers = { ...getHeaders(body), ...options.headers };
  let res = await fetch(`/api/v1${path}`, { ...options, headers, body });

  if (res.status === 401) {
    const retryRes = await handleUnauthorized<T>(path, options, body);
    if (!retryRes) throw new Error('Session expired');
    res = retryRes;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = formatErrorMessage(err, res.status, 'Request failed');
    if (isMutation) emitToast('error', message);
    throw new Error(message);
  }
  if (res.status === 204) {
    if (isMutation) emitToast('success', getSuccessMessage(method));
    return undefined as T;
  }
  const data = await res.json();
  if (isMutation) {
    const msg = typeof data?.message === 'string' && data.message.trim() ? data.message : getSuccessMessage(method);
    emitToast('success', msg);
  }
  return data;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const method = 'POST';
  const headers = getHeaders(formData);
  let res = await fetch(`/api/v1${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401) {
    const retryRes = await handleUnauthorized<T>(path, { method: 'POST' }, formData);
    if (!retryRes) throw new Error('Session expired');
    res = retryRes;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = formatErrorMessage(err, res.status, 'Upload failed');
    emitToast('error', message);
    throw new Error(message);
  }
  const data = await res.json();
  const msg = typeof data?.message === 'string' && data.message.trim() ? data.message : getSuccessMessage(method);
  emitToast('success', msg);
  return data;
}
