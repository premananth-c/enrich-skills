import { useState } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
  textDecoration: 'none',
  fontWeight: isActive ? 600 : 400,
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  background: isActive ? 'var(--color-bg)' : 'transparent',
  borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
  display: 'block',
});

export default function Layout() {
  const { user, logout, canView, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    setPwLoading(true);
    try {
      await api('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
          <img src="/logo.png" alt="RankerShip" style={{ height: 52, display: 'block', marginBottom: '0.35rem' }} />
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>by Vihaan Digital Solutions</div>
        </Link>
        <nav style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavLink to="/" end style={navLinkStyle}>Dashboard</NavLink>
          {canView('courses') && <NavLink to="/courses" style={navLinkStyle}>Courses</NavLink>}
          {canView('batches') && <NavLink to="/batches" style={navLinkStyle}>Batches</NavLink>}
          {canView('tests') && <NavLink to="/tests" style={navLinkStyle}>Tests</NavLink>}
          {canView('questions') && <NavLink to="/questions" style={navLinkStyle}>Questions</NavLink>}
          {canView('students') && <NavLink to="/students" style={navLinkStyle}>Students</NavLink>}
          {canView('reports') && <NavLink to="/reports" style={navLinkStyle}>Reports</NavLink>}
          {isSuperAdmin && <NavLink to="/enquiries" style={navLinkStyle}>Enquiries</NavLink>}
          {isSuperAdmin && <NavLink to="/manage-users" style={navLinkStyle}>Manage Users</NavLink>}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>{user?.email}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setShowPasswordModal(true); setPwError(''); setPwSuccess(false); setCurrentPw(''); setNewPw(''); }}
              style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', padding: '0.3rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}
            >
              Change Password
            </button>
            <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', padding: '0.3rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>

      {showPasswordModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.5rem', width: 360, maxWidth: '90vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem' }}>Change Password</h3>
            {pwSuccess && <div style={{ padding: '0.75rem', background: '#dcfce7', color: '#166534', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>Password changed successfully!</div>}
            {pwError && <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>{pwError}</div>}
            <form onSubmit={handleChangePassword}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Current Password</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', marginBottom: '0.75rem', fontSize: '0.95rem' }} />
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>New Password (min 8 chars)</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', marginBottom: '1rem', fontSize: '0.95rem' }} />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPasswordModal(false)} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={pwLoading} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', opacity: pwLoading ? 0.65 : 1 }}>{pwLoading ? 'Saving...' : 'Change Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
