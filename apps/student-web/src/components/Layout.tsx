import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/tests', label: 'My Tests', icon: '✎' },
  { to: '/courses', label: 'My Courses', icon: '📖' },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  useEffect(() => {
    const fetchUnread = () => {
      api<{ id: string }[]>('/student/notifications?unread=true')
        .then((data) => setUnreadCount(data.length))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
    background: isActive ? 'var(--color-bg)' : 'transparent',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: isActive ? 600 : 400,
    borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
    transition: 'background 0.15s, color 0.15s',
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: sidebarOpen ? 240 : 0,
          overflow: 'hidden',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
          <img src="/logo.png" alt="RankerShip" style={{ height: 36, display: 'block', marginBottom: '0.35rem' }} />
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>by Vihaan Digital Solutions</div>
        </div>

        <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} style={({ isActive }) => navLinkStyle(isActive)}>
              <span style={{ fontSize: '1.1rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
              {item.to === '/notifications' && unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '99px',
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', marginBottom: '0.5rem' }}>
            {user?.name}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { setShowPasswordModal(true); setPwError(''); setPwSuccess(false); setCurrentPw(''); setNewPw(''); }}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {showPasswordModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: '1.5rem', width: 360, maxWidth: '90vw',
            }}
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            padding: '0.6rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface)',
          }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate('/notifications')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: '1.1rem',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '99px',
                    minWidth: 14,
                    textAlign: 'center',
                  }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>
        <main style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
