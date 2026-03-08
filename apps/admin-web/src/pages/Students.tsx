import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import RevisionHistoryModal from '../components/RevisionHistoryModal';
import { useAuth } from '../context/AuthContext';

interface Student {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  phoneNumber?: string | null;
  address?: string | null;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
  inviter: { name: string; email: string };
  test: { id: string; title: string } | null;
}

interface TestOption {
  id: string;
  title: string;
  type: string;
  status?: string;
  variants?: { id: string; name: string; difficulty: string }[];
}

export default function Students() {
  const { isSuperAdmin, canEdit } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTestId, setInviteTestId] = useState('');
  const [inviteVariantId, setInviteVariantId] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [tests, setTests] = useState<TestOption[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phoneNumber: '', address: '', isActive: true });
  const [initialEditForm, setInitialEditForm] = useState({ name: '', email: '', phoneNumber: '', address: '', isActive: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);
  const [directOpen, setDirectOpen] = useState(false);
  const [directForm, setDirectForm] = useState({ name: '', email: '', password: '', phoneNumber: '', address: '' });
  const [resetPw, setResetPw] = useState('');
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwSuccess, setResetPwSuccess] = useState(false);

  const loadStudents = () => {
    api<Student[]>('/users?role=student')
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  };

  const loadInvites = () => {
    setInvitesLoading(true);
    api<Invite[]>('/invites')
      .then(setInvites)
      .catch(() => setInvites([]))
      .finally(() => setInvitesLoading(false));
  };

  useEffect(() => {
    loadStudents();
    loadInvites();
  }, []);

  useEffect(() => {
    if (inviteOpen) {
      api<TestOption[]>('/tests')
        .then((data) => setTests(data.filter((t) => t.status === 'published')))
        .catch(() => setTests([]));
    }
  }, [inviteOpen]);

  const [testDetail, setTestDetail] = useState<TestOption | null>(null);
  useEffect(() => {
    if (!inviteTestId) { setTestDetail(null); return; }
    api<TestOption>(`/tests/${inviteTestId}`).then(setTestDetail).catch(() => setTestDetail(null));
  }, [inviteTestId]);
  const variants = testDetail?.variants || [];

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSending(true);
    setInviteError('');
    try {
      await api('/invites', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          ...(inviteTestId && { testId: inviteTestId }),
          ...(inviteVariantId && { variantId: inviteVariantId }),
        }),
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteTestId('');
      setInviteVariantId('');
      loadStudents();
      loadInvites();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviteSending(false);
    }
  };

  const openEdit = (s: Student) => {
    const next = {
      name: s.name ?? '',
      email: s.email ?? '',
      phoneNumber: s.phoneNumber ?? '',
      address: s.address ?? '',
      isActive: s.isActive ?? true,
    };
    setEditingStudent(s);
    setEditForm(next);
    setInitialEditForm(next);
    setEditError('');
    setResetPw('');
    setResetPwSuccess(false);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditSaving(true);
    setEditError('');
    try {
      const updated = await api<Student>('/users/' + editingStudent.id, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phoneNumber: editForm.phoneNumber.trim() || null,
          address: editForm.address.trim() || null,
          isActive: editForm.isActive,
        }),
      });
      setStudents((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setEditOpen(false);
      setEditingStudent(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update student');
    } finally {
      setEditSaving(false);
    }
  };

  const handleArchive = async (student: Student) => {
    if (!confirm(`Archive student "${student.name}"?`)) return;
    try {
      const archived = await api<Student>('/users/' + student.id + '/archive', { method: 'PATCH' });
      setStudents((prev) => prev.map((s) => (s.id === archived.id ? archived : s)));
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to archive student');
    }
  };

  const handleRevoke = async (student: Student) => {
    if (!confirm(`Revoke archive for student "${student.name}"?`)) return;
    try {
      const restored = await api<Student>('/users/' + student.id + '/revoke', { method: 'PATCH' });
      setStudents((prev) => prev.map((s) => (s.id === restored.id ? restored : s)));
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to revoke archive');
    }
  };

  const handleResendInvite = async (invite: Invite) => {
    try {
      const updated = await api<Invite>(`/invites/${invite.id}/resend`, { method: 'POST' });
      setInvites((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      emitToast('success', `Invite resent to ${invite.email}`);
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to resend invite');
    }
  };

  const handleRevokeInvite = async (invite: Invite) => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
    try {
      await api(`/invites/${invite.id}`, { method: 'DELETE' });
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      emitToast('success', `Invite revoked`);
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to revoke invite');
    }
  };

  const handleDeletePermanently = async (student: Student) => {
    if (!confirm(`Permanently delete student "${student.name}"? All their test attempts, submissions, and data will be removed. This action cannot be undone.`)) return;
    try {
      await api('/users/' + student.id + '/permanent', { method: 'DELETE' });
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to delete student');
    }
  };

  const handleResetStudentPassword = async () => {
    if (!editingStudent || resetPw.length < 8) return;
    setResetPwLoading(true);
    try {
      await api(`/users/${editingStudent.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: resetPw }),
      });
      setResetPw('');
      setResetPwSuccess(true);
      setTimeout(() => setResetPwSuccess(false), 3000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetPwLoading(false);
    }
  };

  const handleCreateDirectStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    await api<Student>('/users/students/direct', {
      method: 'POST',
      body: JSON.stringify(directForm),
    });
    setDirectOpen(false);
    setDirectForm({ name: '', email: '', password: '', phoneNumber: '', address: '' });
    loadStudents();
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };
  const canInvite = !inviteSending && inviteEmail.trim().length > 0;

  const now = new Date();
  // Only show unaccepted invites here; accepted ones appear as registered students
  const pendingInvites = invites.filter((i) => !i.usedAt && new Date(i.expiresAt) > now);
  const expiredInvites = invites.filter((i) => !i.usedAt && new Date(i.expiresAt) <= now);

  const isEditDirty =
    editForm.name !== initialEditForm.name ||
    editForm.email !== initialEditForm.email ||
    editForm.phoneNumber !== initialEditForm.phoneNumber ||
    editForm.address !== initialEditForm.address ||
    editForm.isActive !== initialEditForm.isActive;
  const canSaveEdit = !editSaving && editForm.email.trim().length > 0 && isEditDirty;
  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });
  const activeStudents = filtered.filter((s) => s.isActive);
  const archivedStudents = filtered.filter((s) => !s.isActive);

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const inviteStatusBadge = (invite: Invite) => {
    if (new Date(invite.expiresAt) <= now) {
      return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: '#f59e0b22', color: '#fbbf24', fontWeight: 500 }}>Expired</span>;
    }
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: '#8b5cf622', color: '#a78bfa', fontWeight: 500 }}>Pending</span>;
  };

  const renderInviteRows = (list: Invite[]) =>
    list.map((inv) => (
      <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
        <td style={{ padding: '0.75rem 1rem' }}>{inv.email}</td>
        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{inv.inviter.name}</td>
        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{inv.test?.title ?? <span style={{ opacity: 0.45 }}>—</span>}</td>
        <td style={{ padding: '0.75rem 1rem' }}>{inviteStatusBadge(inv)}</td>
        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{new Date(inv.expiresAt).toLocaleDateString()}</td>
        <td style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleResendInvite(inv)}
              disabled={!canEdit('students')}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', cursor: canEdit('students') ? 'pointer' : 'not-allowed', opacity: canEdit('students') ? 1 : 0.6 }}
            >
              Resend
            </button>
            <button
              type="button"
              onClick={() => handleRevokeInvite(inv)}
              disabled={!canEdit('students')}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', cursor: canEdit('students') ? 'pointer' : 'not-allowed', opacity: canEdit('students') ? 1 : 0.6 }}
            >
              Revoke
            </button>
          </div>
        </td>
      </tr>
    ));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Students</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isSuperAdmin && (
            <button
              onClick={() => setDirectOpen(true)}
              disabled={!canEdit('students')}
              style={{ padding: '0.5rem 1rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6, fontWeight: 500 }}
            >
              Add Student Directly
            </button>
          )}
          <button
            onClick={() => { setInviteOpen(true); setInviteError(''); }}
            disabled={!canEdit('students')}
            style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
          >
            Invite Student
          </button>
        </div>
      </div>
      {/* ── Invited Students ───────────────────────────────────────────── */}
      {(pendingInvites.length > 0 || expiredInvites.length > 0 || invitesLoading) && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            Invited Students
            {pendingInvites.length > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', background: '#8b5cf622', color: '#a78bfa', fontWeight: 600 }}>
                {pendingInvites.length} pending
              </span>
            )}
            {expiredInvites.length > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', background: '#f59e0b22', color: '#fbbf24', fontWeight: 600 }}>
                {expiredInvites.length} expired
              </span>
            )}
          </h2>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {invitesLoading ? (
              <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Loading invites…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Invited By</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Test</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Invited On</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Expires</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem', width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {renderInviteRows(pendingInvites)}
                  {renderInviteRows(expiredInvites)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Registered Students ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students by name or email"
          style={{ width: 380, padding: '0.6rem 0.85rem', background: '#fff', border: '2px solid #d1d5db', borderRadius: 8, color: '#111827', fontWeight: 600 }}
        />
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {activeStudents.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students registered yet. Use &quot;Invite Student&quot; to send an invite by email.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Registered</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem', width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeStudents.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{s.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{s.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: s.isActive ? '#16a34a22' : '#ef444422', color: s.isActive ? '#4ade80' : '#f87171' }}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => openEdit(s)} disabled={!canEdit('students')} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', cursor: canEdit('students') ? 'pointer' : 'not-allowed', opacity: canEdit('students') ? 1 : 0.6 }}>Edit</button>
                      <button type="button" onClick={() => handleArchive(s)} disabled={!canEdit('students')} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', cursor: canEdit('students') ? 'pointer' : 'not-allowed', opacity: canEdit('students') ? 1 : 0.6 }}>Archive</button>
                      <button type="button" onClick={() => setHistoryTarget({ id: s.id, name: s.name })} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', cursor: 'pointer' }}>Revision History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <h2 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.05rem' }}>Archived Students</h2>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {archivedStudents.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No archived students.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archivedStudents.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{s.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{s.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: '#ef444422', color: '#f87171' }}>
                      Archived
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => handleRevoke(s)} disabled={!canEdit('students')} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid #22c55e55', borderRadius: 6, color: '#4ade80', cursor: canEdit('students') ? 'pointer' : 'not-allowed', opacity: canEdit('students') ? 1 : 0.6 }}>Revoke</button>
                      <button type="button" onClick={() => handleDeletePermanently(s)} disabled={!canEdit('students')} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', cursor: canEdit('students') ? 'pointer' : 'not-allowed', opacity: canEdit('students') ? 1 : 0.6 }}>Delete</button>
                      <button type="button" onClick={() => setHistoryTarget({ id: s.id, name: s.name })} style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', cursor: 'pointer' }}>Revision History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 420, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Invite Student</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              An email will be sent with a sign-up link valid for 2 days. The student will set their password and complete their profile (name, phone, address).
            </p>
            {inviteError && <div style={{ padding: '0.5rem', marginBottom: '0.75rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', fontSize: '0.9rem' }}>{inviteError}</div>}
            <form onSubmit={handleInviteSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Email address *</label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required style={inputStyle} placeholder="student@example.com" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Add to test (optional)</label>
                <select value={inviteTestId} onChange={(e) => { setInviteTestId(e.target.value); setInviteVariantId(''); }} style={inputStyle}>
                  <option value="">-- No test --</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              {inviteTestId && variants.length > 0 ? (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Difficulty variant (optional)</label>
                  <select value={inviteVariantId} onChange={(e) => setInviteVariantId(e.target.value)} style={inputStyle}>
                    <option value="">-- Default --</option>
                    {variants.map((v: { id: string; name: string; difficulty: string }) => (
                      <option key={v.id} value={v.id}>{v.name} ({v.difficulty})</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setInviteOpen(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
                <button type="submit" disabled={!canInvite} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canInvite ? 1 : 0.65, cursor: canInvite ? 'pointer' : 'not-allowed' }}>{inviteSending ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {directOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 440, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Add Student Directly</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Create a student account immediately and share credentials offline. Email is optional.
            </p>
            <form onSubmit={handleCreateDirectStudent}>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={labelStyle}>Name *</label>
                <input value={directForm.name} onChange={(e) => setDirectForm((f) => ({ ...f, name: e.target.value }))} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={labelStyle}>Email (optional)</label>
                <input type="email" value={directForm.email} onChange={(e) => setDirectForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={labelStyle}>Password *</label>
                <input type="password" minLength={8} required value={directForm.password} onChange={(e) => setDirectForm((f) => ({ ...f, password: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={labelStyle}>Phone</label>
                <input value={directForm.phoneNumber} onChange={(e) => setDirectForm((f) => ({ ...f, phoneNumber: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '0.8rem' }}>
                <label style={labelStyle}>Address</label>
                <input value={directForm.address} onChange={(e) => setDirectForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={() => setDirectOpen(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
                <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}>Create Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && editingStudent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 420, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Edit Student</h3>
            {editError && <div style={{ padding: '0.5rem', marginBottom: '0.75rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', fontSize: '0.9rem' }}>{editError}</div>}
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Full name" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Email *</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} required style={inputStyle} placeholder="student@example.com" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Phone</label>
                <input value={editForm.phoneNumber} onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))} style={inputStyle} placeholder="Optional" />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Address</label>
                <input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} style={inputStyle} placeholder="Optional" />
              </div>
              <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="edit-isActive" checked={editForm.isActive} onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))} />
                <label htmlFor="edit-isActive" style={labelStyle}>Active (can sign in)</label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => { setEditOpen(false); setEditingStudent(null); }} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
                <button type="submit" disabled={!canSaveEdit} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canSaveEdit ? 1 : 0.65, cursor: canSaveEdit ? 'pointer' : 'not-allowed' }}>{editSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
            {isSuperAdmin && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <label style={{ ...labelStyle, marginBottom: '0.5rem' }}>Reset Password</label>
                {resetPwSuccess && <div style={{ padding: '0.5rem 0.75rem', background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: '0.5rem', fontSize: '0.85rem' }}>Password reset successfully!</div>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="password"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    minLength={8}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleResetStudentPassword}
                    disabled={resetPwLoading || resetPw.length < 8}
                    style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, cursor: resetPw.length >= 8 ? 'pointer' : 'not-allowed', opacity: resetPw.length >= 8 ? 1 : 0.65, whiteSpace: 'nowrap' }}
                  >
                    {resetPwLoading ? 'Resetting...' : 'Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {historyTarget && (
        <RevisionHistoryModal
          module="students"
          entityId={historyTarget.id}
          entityLabel={historyTarget.name}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
