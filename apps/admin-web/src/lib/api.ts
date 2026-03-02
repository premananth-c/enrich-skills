const getToken = () => localStorage.getItem('enrich_admin_token');

function getHeaders(body?: BodyInit | null): HeadersInit {
  const token = getToken();
  const tenantId = localStorage.getItem('enrich_tenant_id');
  const headers: HeadersInit = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(tenantId && { 'X-Tenant-Id': tenantId }),
  };
  if (body && !(body instanceof FormData)) (headers as Record<string, string>)['Content-Type'] = 'application/json';
  return headers;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = options.body;
  const headers = { ...getHeaders(body), ...options.headers };
  const res = await fetch(`/api/v1${path}`, { ...options, headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload file (FormData). Use for materials/upload and batch videos. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = getHeaders(formData);
  const res = await fetch(`/api/v1${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}
