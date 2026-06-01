import { createContext, useContext, useEffect, useState } from 'react';

export interface Branding {
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  supportEmail: string | null;
  customCss: string | null;
  featureFlags: Record<string, unknown>;
}

export interface BrandingPayload {
  tenantId: string | null;
  tenantSlug?: string;
  productName: string;
  branding: Branding | null;
}

interface BrandingContextValue {
  data: BrandingPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

const DEFAULTS: Branding = {
  primaryColor: '#0f172a',
  accentColor: '#0ea5e9',
  logoUrl: null,
  faviconUrl: null,
  supportEmail: null,
  customCss: null,
  featureFlags: {},
};

function applyBranding(payload: BrandingPayload | null): void {
  const root = document.documentElement;
  const b = payload?.branding ?? DEFAULTS;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-accent', b.accentColor);

  if (payload?.productName) {
    document.title = payload.productName;
  }

  if (b.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.faviconUrl;
  }

  const styleId = '__tenant_custom_css';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (b.customCss) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = b.customCss;
  } else if (styleEl) {
    styleEl.remove();
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BrandingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
      const tenantId = localStorage.getItem('enrich_tenant_id');
      const headers: Record<string, string> = {};
      if (tenantId) headers['X-Tenant-Id'] = tenantId;
      if (typeof window !== 'undefined') headers['X-Tenant-Host'] = window.location.hostname;
      const res = await fetch(`${apiBase}/api/v1/branding`, { headers });
      if (!res.ok) throw new Error(`Branding load failed: ${res.status}`);
      const payload = (await res.json()) as BrandingPayload;
      applyBranding(payload);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branding');
      applyBranding(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <BrandingContext.Provider value={{ data, loading, error, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}
