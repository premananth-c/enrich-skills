import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/api';

export default function Layout() {
  const navigate = useNavigate();
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Rankership Super Admin</h1>
        <nav>
          <NavLink to="/tenants" className={({ isActive }) => (isActive ? 'active' : '')}>
            Tenants
          </NavLink>
        </nav>
        <div style={{ marginTop: 32 }}>
          <button
            className="ghost"
            onClick={() => {
              clearToken();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
