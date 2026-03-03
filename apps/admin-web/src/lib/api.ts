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

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = options.body;
  const headers = { ...getHeaders(body), ...options.headers };
  let res = await fetch(`/api/v1${path}`, { ...options, headers, body });

  if (res.status === 401) {
    const retryRes = await handleUnauthorized<T>(path, options, body);
    if (!retryRes) throw new Error('Session expired');
    res = retryRes;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = getHeaders(formData);
  let res = await fetch(`/api/v1${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401) {
    const retryRes = await handleUnauthorized<T>(path, { method: 'POST' }, formData);
    if (!retryRes) throw new Error('Session expired');
    res = retryRes;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}
