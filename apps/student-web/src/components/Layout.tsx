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
    padding: '0.65rem 1rem',
    borderRadius: '8px',
    color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
    background: isActive ? 'var(--color-primary)' : 'transparent',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: isActive ? 600 : 400,
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
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontWeight: 700, fontSize: '1.2rem', whiteSpace: 'nowrap' }}>
            Enrich Skills
          </span>
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name}
          </span>
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
            }}
          >
            Logout
          </button>
        </div>
      </aside>

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
