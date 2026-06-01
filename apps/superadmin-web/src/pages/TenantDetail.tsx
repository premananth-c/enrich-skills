import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  domains: TenantDomain[];
  branding: TenantBranding | null;
  dbConfig: { provisionedAt: string | null } | null;
}
interface TenantDomain {
  id: string;
  host: string;
  kind: string;
  verifiedAt: string | null;
  cloudflareHostnameId: string | null;
}
interface TenantBranding {
  productName: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  supportEmail: string | null;
  customCss: string | null;
}

type Tab = 'overview' | 'branding' | 'domains' | 'payments';

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!id) return;
    try {
      const data = await api<Tenant>(`/superadmin/tenants/${id}`);
      setTenant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!tenant) {
    return (
      <div>
        <button className="ghost" onClick={() => navigate('/tenants')}>← Tenants</button>
        {error ? <div className="error">{error}</div> : <div className="muted">Loading…</div>}
      </div>
    );
  }

  return (
    <div>
      <button className="ghost" onClick={() => navigate('/tenants')}>← Tenants</button>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>
          {tenant.name} <span className="muted" style={{ fontSize: 14 }}>({tenant.slug})</span>{' '}
          <span className={`badge ${tenant.status === 'active' ? 'ok' : tenant.status === 'cancelled' ? 'danger' : 'warn'}`}>
            {tenant.status}
          </span>
        </h2>
      </div>

      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'branding' ? 'active' : ''} onClick={() => setTab('branding')}>Branding</button>
        <button className={tab === 'domains' ? 'active' : ''} onClick={() => setTab('domains')}>Domains</button>
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Payments</button>
      </div>

      {tab === 'overview' && <OverviewTab tenant={tenant} />}
      {tab === 'branding' && <BrandingTab tenantId={tenant.id} branding={tenant.branding} onSaved={reload} />}
      {tab === 'domains' && <DomainsTab tenantId={tenant.id} domains={tenant.domains} onChanged={reload} />}
      {tab === 'payments' && <PaymentsTab tenantId={tenant.id} />}
    </div>
  );
}

function OverviewTab({ tenant }: { tenant: Tenant }) {
  return (
    <div className="card">
      <p>
        <strong>Tenant ID:</strong> <span className="muted">{tenant.id}</span>
      </p>
      <p>
        <strong>Database:</strong>{' '}
        <span className="muted">
          {tenant.dbConfig
            ? `provisioned ${new Date(tenant.dbConfig.provisionedAt ?? Date.now()).toLocaleString()}`
            : 'no dedicated DB (using legacy fallback)'}
        </span>
      </p>
      <p>
        <strong>Domains:</strong>{' '}
        <span className="muted">{tenant.domains.length === 0 ? 'none' : tenant.domains.map((d) => d.host).join(', ')}</span>
      </p>
    </div>
  );
}

function BrandingTab({
  tenantId,
  branding,
  onSaved,
}: {
  tenantId: string;
  branding: TenantBranding | null;
  onSaved: () => void;
}) {
  const [productName, setProductName] = useState(branding?.productName ?? '');
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? '#0f172a');
  const [accentColor, setAccentColor] = useState(branding?.accentColor ?? '#0ea5e9');
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? '');
  const [faviconUrl, setFaviconUrl] = useState(branding?.faviconUrl ?? '');
  const [supportEmail, setSupportEmail] = useState(branding?.supportEmail ?? '');
  const [customCss, setCustomCss] = useState(branding?.customCss ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api(`/superadmin/tenants/${tenantId}/branding`, {
        method: 'PUT',
        body: {
          productName: productName || undefined,
          primaryColor,
          accentColor,
          logoUrl: logoUrl || undefined,
          faviconUrl: faviconUrl || undefined,
          supportEmail: supportEmail || undefined,
          customCss: customCss || undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="field">
        <label>Product name</label>
        <input value={productName} onChange={(e) => setProductName(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Primary color</label>
          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
        </div>
        <div className="field">
          <label>Accent color</label>
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Logo URL</label>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.svg" />
      </div>
      <div className="field">
        <label>Favicon URL</label>
        <input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://…/favicon.ico" />
      </div>
      <div className="field">
        <label>Support email</label>
        <input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@example.com" />
      </div>
      <div className="field">
        <label>Custom CSS</label>
        <textarea rows={5} value={customCss} onChange={(e) => setCustomCss(e.target.value)} />
      </div>
      {error && <div className="error">{error}</div>}
      <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save branding'}</button>
    </div>
  );
}

function DomainsTab({
  tenantId,
  domains,
  onChanged,
}: {
  tenantId: string;
  domains: TenantDomain[];
  onChanged: () => void;
}) {
  const [host, setHost] = useState('');
  const [kind, setKind] = useState<'admin' | 'student'>('admin');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!host.trim()) return;
    setError(null);
    setAdding(true);
    try {
      await api(`/superadmin/tenants/${tenantId}/domains`, {
        method: 'POST',
        body: { host: host.trim().toLowerCase(), kind },
      });
      setHost('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setAdding(false);
    }
  }

  async function remove(domainId: string) {
    if (!confirm('Remove this domain?')) return;
    try {
      await api(`/superadmin/tenants/${tenantId}/domains/${domainId}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add custom hostname</h3>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2 }}>
            <label>Host</label>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="lms.acme.com" />
          </div>
          <div className="field">
            <label>Kind</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as 'admin' | 'student')}>
              <option value="admin">admin</option>
              <option value="student">student</option>
            </select>
          </div>
          <div className="field">
            <button onClick={add} disabled={adding || !host.trim()}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          After saving, point your DNS CNAME at the Cloudflare for SaaS fallback origin. TLS is
          provisioned automatically (M5).
        </p>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Host</th>
              <th>Kind</th>
              <th>Verified</th>
              <th>CF hostname</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  No domains yet
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr key={d.id}>
                  <td>{d.host}</td>
                  <td className="muted">{d.kind}</td>
                  <td>
                    {d.verifiedAt ? (
                      <span className="badge ok">verified</span>
                    ) : (
                      <span className="badge warn">pending</span>
                    )}
                  </td>
                  <td className="muted">{d.cloudflareHostnameId ?? '—'}</td>
                  <td>
                    <button className="ghost" onClick={() => remove(d.id)}>Remove</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface PaymentCred {
  id: string;
  provider: string;
  publicKey: string;
  mode: string;
  currency: string;
  isActive: boolean;
}

function PaymentsTab({ tenantId }: { tenantId: string }) {
  const [creds, setCreds] = useState<PaymentCred[]>([]);
  const [editing, setEditing] = useState<'razorpay' | 'stripe' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<PaymentCred[]>(`/superadmin/tenants/${tenantId}/payment-credentials`);
      setCreds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Payment providers</h3>
        {creds.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>No credentials configured yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Provider</th><th>Mode</th><th>Currency</th><th>Public key</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {creds.map((c) => (
                <tr key={c.id}>
                  <td>{c.provider}</td>
                  <td className="muted">{c.mode}</td>
                  <td className="muted">{c.currency}</td>
                  <td className="muted" style={{ fontFamily: 'monospace' }}>{c.publicKey}</td>
                  <td>
                    {c.isActive ? <span className="badge ok">on</span> : <span className="badge danger">off</span>}
                  </td>
                  <td>
                    <button className="ghost" onClick={() => setEditing(c.provider as 'razorpay' | 'stripe')}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {!creds.find((c) => c.provider === 'razorpay') && (
            <button onClick={() => setEditing('razorpay')}>+ Razorpay</button>
          )}
          {!creds.find((c) => c.provider === 'stripe') && (
            <button onClick={() => setEditing('stripe')}>+ Stripe</button>
          )}
        </div>
      </div>

      {editing && (
        <PaymentEditor
          tenantId={tenantId}
          provider={editing}
          onClose={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}

function PaymentEditor({
  tenantId,
  provider,
  onClose,
}: {
  tenantId: string;
  provider: 'razorpay' | 'stripe';
  onClose: () => void;
}) {
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const [currency, setCurrency] = useState(provider === 'stripe' ? 'USD' : 'INR');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await api(`/superadmin/tenants/${tenantId}/payment-credentials/${provider}`, {
        method: 'PUT',
        body: { publicKey, secretKey, webhookSecret: webhookSecret || undefined, mode, currency, isActive: true },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0, textTransform: 'capitalize' }}>{provider} credentials</h3>
      <div className="field">
        <label>Public key {provider === 'razorpay' ? '(Key ID)' : '(pk_…)'}</label>
        <input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} />
      </div>
      <div className="field">
        <label>Secret key {provider === 'razorpay' ? '(Key Secret)' : '(sk_…)'}</label>
        <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
      </div>
      <div className="field">
        <label>Webhook secret (optional)</label>
        <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
      </div>
      <div className="row">
        <div className="field">
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'live' | 'test')}>
            <option value="test">test</option>
            <option value="live">live</option>
          </select>
        </div>
        <div className="field">
          <label>Currency</label>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={saving || !publicKey || !secretKey}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
