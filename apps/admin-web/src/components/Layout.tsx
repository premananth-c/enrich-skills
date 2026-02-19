import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 600 }}>Admin</Link>
        <nav style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Dashboard</Link>
          <Link to="/tests" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Tests</Link>
          <Link to="/questions" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Questions</Link>
          <Link to="/students" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>Students</Link>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>{user?.email}</span>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ display: 'block', marginTop: '0.5rem', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', padding: '0.4rem', borderRadius: 4 }}>Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  );
}
