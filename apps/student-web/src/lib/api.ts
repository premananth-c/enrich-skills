import { emitToast } from './toast';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'enrich_access_token';
const REFRESH_KEY = 'enrich_refresh_token';
const TENANT_KEY = 'enrich_tenant_id';

let refreshPromise: Promise<string | null> | null = null;

/** Returns null when the UI should not show a generic success toast (caller feedback or misleading default). */
function getSuccessMessage(method: string, path: string): string | null {
  // Starting an attempt is not a submission; toast was shown as the test page opened.
  if (path === '/attempts/start' || path.startsWith('/attempts/start')) return null;
  // Run output is shown in the editor; "Submitted successfully" is wrong here too.
  if (path.includes('/run-code')) return null;
  if (method === 'POST') return 'Submitted successfully';
  if (method === 'PUT' || method === 'PATCH') return 'Updated successfully';
  if (method === 'DELETE') return 'Deleted successfully';
  return 'Action completed';
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
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

function buildHeaders(token: string | null, options: RequestInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
  const tenantId = localStorage.getItem(TENANT_KEY);
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  if (options.headers) Object.assign(headers, options.headers);
  return headers;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = method !== 'GET';
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = buildHeaders(token, options);

  // Fastify requires a non-empty body when Content-Type is application/json
  const body =
    options.body !== undefined
      ? typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
      : isMutation
        ? '{}'
        : undefined;

  let res = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers, body });

  if (res.status === 401) {
    const newToken = await getRefreshedToken();
    if (newToken) {
      const retryHeaders = buildHeaders(newToken, options);
      res = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers: retryHeaders, body });
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('enrich_user');
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error || `Request failed: ${res.status}`;
    if (isMutation) emitToast('error', message);
    throw new Error(message);
  }
  if (res.status === 204) {
    if (isMutation) {
      const msg = getSuccessMessage(method, path);
      if (msg) emitToast('success', msg);
    }
    return undefined as T;
  }
  const data = await res.json();
  if (isMutation) {
    const msg =
      typeof data?.message === 'string' && data.message.trim()
        ? data.message
        : getSuccessMessage(method, path);
    if (msg) emitToast('success', msg);
  }
  return data;
}
