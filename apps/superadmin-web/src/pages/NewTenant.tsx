import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface ProvisionResult {
  tenantId: string;
  slug: string;
  dbName: string;
  dbRole: string;
}

export default function NewTenant() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [primaryHost, setPrimaryHost] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [accentColor, setAccentColor] = useState('#0ea5e9');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<ProvisionResult>('/superadmin/tenants', {
        method: 'POST',
        body: {
          name,
          slug,
          primaryHost: primaryHost || undefined,
          branding: { primaryColor, secondaryColor: accentColor },
        },
      });
      navigate(`/tenants/${result.tenantId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="toolbar">
        <h2>Onboard a new tenant</h2>
      </div>
      <form onSubmit={onSubmit} className="card">
        <div className="field">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
            }}
            placeholder="Acme Learning"
            required
          />
        </div>
        <div className="field">
          <label>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[a-z0-9-]+"
            placeholder="acme-learning"
            required
          />
          <small className="muted">Used for the tenant DB name (tenant_&lt;slug&gt;).</small>
        </div>
        <div className="field">
          <label>Primary host (optional)</label>
          <input
            value={primaryHost}
            onChange={(e) => setPrimaryHost(e.target.value)}
            placeholder="lms.acme.com"
          />
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

        {error && <div className="error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Provisioning…' : 'Onboard tenant'}
          </button>
          <button type="button" className="ghost" onClick={() => navigate('/tenants')}>
            Cancel
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          This creates a Postgres role and database (tenant_&lt;slug&gt;) on your Postgres cluster, runs
          tenant-schema migrations on it, stores the encrypted connection URL in the control plane,
          and seeds default branding. Allow ~10–30s.
        </p>
      </form>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
