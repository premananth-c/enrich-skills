import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600, fontSize: '1.25rem' }}>
          Enrich Skills
        </Link>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Dashboard
          </Link>
          <Link to="/tests" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Tests
          </Link>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{user?.name}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
