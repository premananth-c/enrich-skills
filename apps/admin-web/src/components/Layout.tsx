import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none', fontSize: '1.25rem', fontWeight: 600 }}>Admin</Link>
        <nav style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <NavLink to="/" end style={navLinkStyle}>Dashboard</NavLink>
          <NavLink to="/courses" style={navLinkStyle}>Courses</NavLink>
          <NavLink to="/batches" style={navLinkStyle}>Batches</NavLink>
          <NavLink to="/tests" style={navLinkStyle}>Tests</NavLink>
          <NavLink to="/questions" style={navLinkStyle}>Questions</NavLink>
          <NavLink to="/students" style={navLinkStyle}>Students</NavLink>
          <NavLink to="/reports" style={navLinkStyle}>Reports</NavLink>
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
