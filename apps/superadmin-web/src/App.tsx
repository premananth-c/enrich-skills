import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getToken } from './lib/api';
import Login from './pages/Login';
import Layout from './components/Layout';
import Tenants from './pages/Tenants';
import NewTenant from './pages/NewTenant';
import TenantDetail from './pages/TenantDetail';

function RequireAuth({ children }: { children: JSX.Element }) {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  useEffect(() => {
    setAuthed(!!getToken());
  }, []);
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/tenants" replace />} />
        <Route path="/tenants" element={<Tenants />} />
        <Route path="/tenants/new" element={<NewTenant />} />
        <Route path="/tenants/:id" element={<TenantDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/tenants" replace />} />
    </Routes>
  );
}
