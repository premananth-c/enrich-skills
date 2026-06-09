import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';
import {
  adminBtnPrimary,
  adminBtnPrimaryDisabled,
  adminBtnDestructive,
  adminBtnDestructiveDisabled,
} from '../lib/adminButtonStyles';

interface ClientRow {
  id: string;
  name: string;
  isGeneral: boolean;
  isArchived: boolean;
  createdAt: string;
  _count: { members: number; batches: number; studentUsers: number };
}

export default function Clients() {
  const { canEdit } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadClients = () => {
    api<ClientRow[]>('/clients?includeArchived=true')
      .then(setClients)
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClients(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await api('/clients', { method: 'POST', body: JSON.stringify({ name: createName.trim() }) });
      setCreateName('');
      setCreateOpen(false);
      emitToast('success', 'Client created');
      loadClients();
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const toggleArchive = async (client: ClientRow) => {
    try {
      await api(`/clients/${client.id}`, { method: 'PATCH', body: JSON.stringify({ isArchived: !client.isArchived }) });
      emitToast('success', client.isArchived ? 'Client restored' : 'Client archived');
      loadClients();
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Action failed');
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const active = clients.filter((c) => !c.isArchived);
  const archived = clients.filter((c) => c.isArchived);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Clients</h1>
        {canEdit('clients') && (
          <button type="button" onClick={() => setCreateOpen(true)} style={adminBtnPrimary}>+ Create Client</button>
        )}
      </div>

      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={handleCreate} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.5rem', width: 380 }}>
            <h3 style={{ margin: '0 0 1rem' }}>Create Client</h3>
            <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Client Name</label>
            <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} required style={inputStyle} autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" disabled={creating || !createName.trim()} style={adminBtnPrimaryDisabled(creating || !createName.trim())}>{creating ? 'Creating...' : 'Create'}</button>
              <button type="button" onClick={() => { setCreateOpen(false); setCreateName(''); }} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem' }}>Loading...</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Members</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Batches</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Students</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/clients/${c.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{c.name}</Link>
                    {c.isGeneral && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>default</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{c._count.members}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{c._count.batches}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{c._count.studentUsers}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {canEdit('clients') && !c.isGeneral && (
                      <button type="button" onClick={() => toggleArchive(c)} style={adminBtnDestructiveDisabled(false)}>Archive</button>
                    )}
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No active clients.</td></tr>
              )}
            </tbody>
          </table>

          {archived.length > 0 && (
            <>
              <h3 style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Archived clients</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {archived.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.6 }}>
                      <td style={{ padding: '0.5rem 1rem' }}>{c.name}</td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        {canEdit('clients') && (
                          <button type="button" onClick={() => toggleArchive(c)} style={{ ...adminBtnPrimary, padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}>Restore</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
