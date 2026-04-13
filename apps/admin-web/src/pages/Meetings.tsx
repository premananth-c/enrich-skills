import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import { adminBtnPrimary, adminBtnPrimarySm, adminBtnDestructiveTable } from '../lib/adminButtonStyles';

interface Meeting {
  id: string;
  name: string;
  type: 'interactive_meeting' | 'webinar';
  maxParticipants: number;
  status: 'scheduled' | 'live' | 'ended';
  scheduledAt: string | null;
  createdAt: string;
  host?: { id: string; name: string; email: string | null };
  batch?: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  scheduled: '#2563eb',
  live: '#16a34a',
  ended: '#6b7280',
};

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const loadMeetings = () => {
    setLoading(true);
    api<Meeting[]>('/meetings')
      .then(setMeetings)
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMeetings(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete meeting "${name}"? This cannot be undone.`)) return;
    try {
      await api(`/meetings/${id}`, { method: 'DELETE' });
      loadMeetings();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const filtered = meetings.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Live Meetings</h1>
        <button type="button" onClick={() => navigate('/meetings/new')} style={adminBtnPrimary}>
          + Create Meeting
        </button>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meetings by name"
          style={{ width: 380, padding: '0.6rem 0.85rem', background: '#fff', border: '2px solid #d1d5db', borderRadius: 8, color: '#111827', fontWeight: 600 }}
        />
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No meetings yet. Create a meeting or webinar to get started.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Max Participants</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Scheduled</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/meetings/${m.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{m.name}</Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>
                    {m.type === 'webinar' ? 'Webinar' : 'Interactive Meeting'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{m.maxParticipants}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500, background: `${statusColors[m.status] ?? '#6b7280'}18`, color: statusColors[m.status] ?? '#6b7280' }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => navigate(`/meetings/${m.id}`)} style={adminBtnPrimarySm}>View</button>
                      {m.status !== 'ended' && (
                        <button type="button" onClick={() => handleDelete(m.id, m.name)} style={adminBtnDestructiveTable}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
