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
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  register: (email: string, password: string, name: string, tenantId?: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: User, accessToken: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'enrich_access_token';
const USER_KEY = 'enrich_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const stored = localStorage.getItem(USER_KEY);
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
        setAccessToken(token);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setAuth = useCallback((u: User, token: string) => {
    setUser(u);
    setAccessToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    if (u.tenantId) localStorage.setItem('enrich_tenant_id', u.tenantId);
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
    setAuth(data.user, data.accessToken);
  }, [setAuth]);

  const register = useCallback(async (email: string, password: string, name: string, tenantId?: string) => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tenantId && { 'X-Tenant-Id': tenantId }) },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    setAuth(data.user, data.accessToken);
  }, [setAuth]);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('enrich_tenant_id');
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
