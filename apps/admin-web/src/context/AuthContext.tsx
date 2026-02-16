import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  logout: () => void;
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
        localStorage.removeItem('enrich_admin_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, tenantId?: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tenantId && { 'X-Tenant-Id': tenantId }) },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setUser(data.user);
    localStorage.setItem('enrich_admin_token', data.accessToken);
    localStorage.setItem('enrich_admin_user', JSON.stringify(data.user));
    if (data.user.tenantId) localStorage.setItem('enrich_tenant_id', data.user.tenantId);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('enrich_admin_token');
    localStorage.removeItem('enrich_admin_user');
    localStorage.removeItem('enrich_tenant_id');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
