import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
  status: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  student: 'Student',
  college: 'College',
  corporate: 'Corporate',
  academic: 'Academic Institution',
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'closed', label: 'Closed' },
];

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await api<{ enquiries: Enquiry[]; total: number }>(`/enquiries?${params.toString()}`);
      setEnquiries(res.enquiries);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    await api(`/enquiries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const truncate = (str: string, len: number) =>
    str.length <= len ? str : str.slice(0, len) + '...';

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Business Enquiries</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
            }}
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
        Reach out to leads via email or phone. Click email/phone to contact directly.
      </p>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'auto' }}>
        <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Name</th>
              <th style={{ padding: '0.75rem 1rem' }}>Email</th>
              <th style={{ padding: '0.75rem 1rem' }}>Phone</th>
              <th style={{ padding: '0.75rem 1rem' }}>Category</th>
              <th style={{ padding: '0.75rem 1rem' }}>Message</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {enquiries.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No enquiries yet.
                </td>
              </tr>
            ) : (
              enquiries.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{e.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a href={`mailto:${e.email}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                      {e.email}
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <a href={`tel:${e.phone}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
                      {e.phone}
                    </a>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{CATEGORY_LABELS[e.category] ?? e.category}</td>
                  <td style={{ padding: '0.75rem 1rem', maxWidth: 200 }} title={e.message}>
                    {truncate(e.message, 60)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <select
                      value={e.status}
                      onChange={(ev) => void handleStatusChange(e.id, ev.target.value)}
                      style={{
                        padding: '0.35rem 0.5rem',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                      }}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Total: {total}</div>
    </div>
  );
}
