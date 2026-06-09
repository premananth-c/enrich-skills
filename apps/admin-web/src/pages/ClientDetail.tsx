import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';
import {
  adminBtnPrimary,
  adminBtnPrimaryDisabled,
  adminBtnDestructive,
  adminBtnDestructiveDisabled,
  adminBtnCancel,
} from '../lib/adminButtonStyles';

interface ClientMember {
  id: string;
  userId: string;
  user: { id: string; email: string | null; name: string; role: string };
}

interface ClientInfo {
  id: string;
  name: string;
  isGeneral: boolean;
  isArchived: boolean;
  members: ClientMember[];
  _count: { batches: number; studentUsers: number };
}

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [adding, setAdding] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [editName, setEditName] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const loadClient = () => {
    if (!id) return;
    api<ClientInfo>(`/clients/${id}`)
      .then((c) => {
        setClient(c);
        setEditName(c.name);
      })
      .catch(() => navigate('/clients'))
      .finally(() => setLoading(false));
  };

  const loadAdmins = () => {
    api<AdminUser[]>('/users')
      .then((users) => setAdmins(users.filter((u) => u.role !== 'student')))
      .catch(() => setAdmins([]));
  };

  useEffect(() => { loadClient(); loadAdmins(); }, [id]);

  const memberIds = new Set(client?.members.map((m) => m.userId) ?? []);
  const availableAdmins = admins.filter((a) => !memberIds.has(a.id));

  const addMember = async () => {
    if (!addUserId || !id) return;
    setAdding(true);
    try {
      await api(`/clients/${id}/members`, { method: 'POST', body: JSON.stringify({ userId: addUserId }) });
      setAddUserId('');
      emitToast('success', 'Member added');
      loadClient();
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!id) return;
    try {
      await api(`/clients/${id}/members/${userId}`, { method: 'DELETE' });
      emitToast('success', 'Member removed');
      loadClient();
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !id) return;
    setInviting(true);
    setInviteError('');
    try {
      await api(`/clients/${id}/members/invite`, { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim() }) });
      setInviteEmail('');
      emitToast('success', 'Invite sent');
      loadClient();
      loadAdmins();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !id) return;
    setEditSaving(true);
    try {
      await api(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify({ name: editName.trim() }) });
      setEditOpen(false);
      emitToast('success', 'Client updated');
      loadClient();
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };

  if (loading || !client) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/clients" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>← Clients</Link>
        <h1 style={{ margin: 0 }}>{client.name}</h1>
        {canEdit('clients') && !client.isGeneral && (
          <button type="button" onClick={() => setEditOpen(true)} style={adminBtnCancel}>Rename</button>
        )}
        {client.isGeneral && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>default</span>}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem 1.5rem', minWidth: 120, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{client._count.batches}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Batches</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem 1.5rem', minWidth: 120, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{client._count.studentUsers}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Students</div>
        </div>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem 1.5rem', minWidth: 120, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{client.members.length}</div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Members</div>
        </div>
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Members (admin users)</h3>

        {canEdit('clients') && (
          <>
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 220px', minWidth: 180, maxWidth: 320 }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Add existing admin</label>
                <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} style={inputStyle}>
                  <option value="">Select admin user...</option>
                  {availableAdmins.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.email ?? 'no email'})</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={addMember} disabled={adding || !addUserId} style={adminBtnPrimaryDisabled(adding || !addUserId)}>Add</button>
            </div>

            <form onSubmit={inviteMember} style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, maxWidth: 520 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Invite by email</label>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Creates a new admin user and adds them to this client. They will receive a temporary password by email.
              </p>
              {inviteError && <div style={{ padding: '0.45rem 0.6rem', marginBottom: '0.5rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>{inviteError}</div>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="email" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }} placeholder="admin@example.com" style={{ ...inputStyle, flex: '1 1 200px', minWidth: 180, maxWidth: 280 }} />
                <button type="submit" disabled={inviting || !inviteEmail.trim()} style={adminBtnPrimaryDisabled(inviting || !inviteEmail.trim())}>{inviting ? 'Sending...' : 'Send Invite'}</button>
              </div>
            </form>
          </>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
              <th style={{ padding: '0.5rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
              <th style={{ padding: '0.5rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Role</th>
              {canEdit('clients') && <th style={{ padding: '0.5rem 1rem' }} />}
            </tr>
          </thead>
          <tbody>
            {client.members.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '0.5rem 1rem' }}>{m.user.name}</td>
                <td style={{ padding: '0.5rem 1rem', color: 'var(--color-text-muted)' }}>{m.user.email ?? '--'}</td>
                <td style={{ padding: '0.5rem 1rem' }}>{m.user.role}</td>
                {canEdit('clients') && (
                  <td style={{ padding: '0.5rem 1rem' }}>
                    <button type="button" onClick={() => removeMember(m.userId)} style={adminBtnDestructiveDisabled(false)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
            {client.members.length === 0 && (
              <tr><td colSpan={canEdit('clients') ? 4 : 3} style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>No members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <form onSubmit={saveEdit} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1.5rem', width: 380 }}>
            <h3 style={{ margin: '0 0 1rem' }}>Rename Client</h3>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required style={inputStyle} autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" disabled={editSaving || !editName.trim()} style={adminBtnPrimaryDisabled(editSaving || !editName.trim())}>{editSaving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => { setEditOpen(false); setEditName(client.name); }} style={adminBtnCancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
