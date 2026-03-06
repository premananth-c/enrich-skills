import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email?: string | null;
  name: string;
  role: string;
  tenantId: string;
  permissions?: Record<string, 'none' | 'view' | 'edit'>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  logout: () => void;
  canView: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('enrich_admin_token');
    const stored = localStorage.getItem('enrich_admin_user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('enrich_admin_token');
        localStorage.removeItem('enrich_admin_refresh_token');
        localStorage.removeItem('enrich_admin_user');
      }
    }
    setLoading(false);
  }, []);

  const apiBase = import.meta.env.VITE_API_URL ?? '';

  const login = useCallback(async (email: string, password: string, tenantId?: string) => {
    const res = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tenantId && { 'X-Tenant-Id': tenantId }) },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    if (data.user?.role === 'student') {
      throw new Error('You dont have permission to view this page.');
    }
    setUser(data.user);
    localStorage.setItem('enrich_admin_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('enrich_admin_refresh_token', data.refreshToken);
    localStorage.setItem('enrich_admin_user', JSON.stringify(data.user));
    if (data.user.tenantId) localStorage.setItem('enrich_tenant_id', data.user.tenantId);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('enrich_admin_token');
    localStorage.removeItem('enrich_admin_refresh_token');
    localStorage.removeItem('enrich_admin_user');
    localStorage.removeItem('enrich_tenant_id');
  }, []);

  const canView = useCallback(
    (moduleKey: string) => {
      if (!user) return false;
      if (user.role === 'super_admin') return true;
      if (user.role === 'admin') return moduleKey !== 'manage_users';
      const permission = user.permissions?.[moduleKey];
      return permission === 'view' || permission === 'edit';
    },
    [user]
  );

  const canEdit = useCallback(
    (moduleKey: string) => {
      if (!user) return false;
      if (user.role === 'super_admin') return true;
      if (user.role === 'admin') return moduleKey !== 'manage_users';
      return user.permissions?.[moduleKey] === 'edit';
    },
    [user]
  );

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canView, canEdit, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
