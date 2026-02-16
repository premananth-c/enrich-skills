const getToken = () => localStorage.getItem('enrich_access_token');

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const tenantId = localStorage.getItem('enrich_tenant_id');
  if (tenantId) {
    (headers as Record<string, string>)['X-Tenant-Id'] = tenantId;
  }
  const res = await fetch(`/api/v1${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
