import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  domains: Array<{ id: string; host: string; kind: string; verifiedAt: string | null }>;
  dbConfig: { provisionedAt: string | null; dbName: string } | null;
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Tenant[]>('/superadmin/tenants')
      .then((data) => setTenants(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="toolbar">
        <h2>Tenants</h2>
        <Link to="/tenants/new">
          <button>+ Onboard tenant</button>
        </Link>
      </div>

      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="muted">Loading…</div>
      ) : tenants.length === 0 ? (
        <div className="card muted">No tenants yet. Click "Onboard tenant" to create one.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Domains</th>
                <th>DB</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tenants/${t.id}`}>{t.name}</Link>
                  </td>
                  <td className="muted">{t.slug}</td>
                  <td>
                    <span className={`badge ${t.status === 'active' ? 'ok' : t.status === 'cancelled' ? 'danger' : 'warn'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="muted">
                    {t.domains.length > 0 ? t.domains.map((d) => d.host).join(', ') : '—'}
                  </td>
                  <td className="muted">{t.dbConfig?.dbName ?? '—'}</td>
                  <td className="muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
