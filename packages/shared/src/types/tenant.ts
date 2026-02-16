export type TenantStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
  brandingConfig: BrandingConfig;
  domain: string | null;
  status: TenantStatus;
  featureFlags: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  customCss?: string;
}
