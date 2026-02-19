import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Student {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface TestOption {
  id: string;
  title: string;
  type: string;
  variants?: { id: string; name: string; difficulty: string }[];
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTestId, setInviteTestId] = useState('');
  const [inviteVariantId, setInviteVariantId] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [tests, setTests] = useState<TestOption[]>([]);

  const loadStudents = () => {
    api<Student[]>('/users?role=student')
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (inviteOpen) {
      api<TestOption[]>('/tests').then(setTests).catch(() => setTests([]));
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
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviteSending(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Students</h1>
        <button
          onClick={() => { setInviteOpen(true); setInviteError(''); }}
          style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
        >
          Invite Student
        </button>
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {students.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students registered yet. Use &quot;Invite Student&quot; to send an invite by email.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{s.name}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{s.email}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: s.isActive ? '#16a34a22' : '#ef444422', color: s.isActive ? '#4ade80' : '#f87171' }}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
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
                <button type="submit" disabled={inviteSending} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: inviteSending ? 0.7 : 1 }}>{inviteSending ? 'Sending...' : 'Send invite'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
