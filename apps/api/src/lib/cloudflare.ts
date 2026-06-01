/**
 * Cloudflare for SaaS — custom hostname automation.
 *
 * Registers each tenant custom domain as a Cloudflare custom hostname,
 * which gives us automatic TLS issuance and edge routing without per-tenant
 * cert work. See https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
 *
 * Configuration:
 *   CF_API_TOKEN          - API token with #zone:edit on the zone below
 *   CF_ZONE_ID            - Zone ID for the SaaS apex (e.g. rankership.com)
 *   CF_FALLBACK_ORIGIN    - Hostname tenants CNAME to (e.g. lms.rankership.com)
 */
const CF_API = 'https://api.cloudflare.com/client/v4';

export interface CfHostname {
  id: string;
  hostname: string;
  status: 'pending' | 'active' | 'active_redeploying' | 'moved' | 'pending_deletion' | 'deleted' | 'deactivated' | 'blocked';
  ssl?: { status: string; method?: string };
  ownership_verification?: { type: string; name: string; value: string };
  ownership_verification_http?: { http_url: string; http_body: string };
}

interface CfResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: T;
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = envOrThrow('CF_API_TOKEN');
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = (await res.json()) as CfResponse<T>;
  if (!json.success) {
    const message = json.errors?.map((e) => `${e.code}: ${e.message}`).join(', ') || 'Cloudflare API error';
    throw new Error(message);
  }
  return json.result;
}

export async function registerCustomHostname(host: string): Promise<CfHostname> {
  const zoneId = envOrThrow('CF_ZONE_ID');
  return cfFetch<CfHostname>(`/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    body: JSON.stringify({
      hostname: host,
      ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
    }),
  });
}

export async function getCustomHostname(hostnameId: string): Promise<CfHostname> {
  const zoneId = envOrThrow('CF_ZONE_ID');
  return cfFetch<CfHostname>(`/zones/${zoneId}/custom_hostnames/${hostnameId}`);
}

export async function deleteCustomHostname(hostnameId: string): Promise<void> {
  const zoneId = envOrThrow('CF_ZONE_ID');
  await cfFetch<{ id: string }>(`/zones/${zoneId}/custom_hostnames/${hostnameId}`, {
    method: 'DELETE',
  });
}

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env.CF_API_TOKEN && process.env.CF_ZONE_ID);
}

export function getFallbackOrigin(): string | null {
  return process.env.CF_FALLBACK_ORIGIN ?? null;
}
