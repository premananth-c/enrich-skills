import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { emitToast } from '../lib/toast';

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
  registerWithInvite: (token: string, password: string, name: string, phoneNumber: string, address: string) => Promise<void>;
  logout: () => void;
  setAuth: (user: User, accessToken: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'enrich_access_token';
const REFRESH_KEY = 'enrich_refresh_token';
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
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const setAuth = useCallback((u: User, token: string, refresh?: string) => {
    setUser(u);
    setAccessToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
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
      emitToast('error', err.error || 'Login failed');
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    setAuth(data.user, data.accessToken, data.refreshToken);
    emitToast('success', 'Signed in successfully');
  }, [setAuth]);

  const register = useCallback(async (email: string, password: string, name: string, tenantId?: string) => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tenantId && { 'X-Tenant-Id': tenantId }) },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      emitToast('error', err.error || 'Registration failed');
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    setAuth(data.user, data.accessToken, data.refreshToken);
    emitToast('success', 'Account created successfully');
  }, [setAuth]);

  const registerWithInvite = useCallback(async (token: string, password: string, name: string, phoneNumber: string, address: string) => {
    const res = await fetch('/api/v1/auth/register-with-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, name, phoneNumber, address }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      emitToast('error', err.error || 'Sign up failed');
      throw new Error(err.error || 'Sign up failed');
    }
    const data = await res.json();
    setAuth(data.user, data.accessToken, data.refreshToken);
    emitToast('success', 'Account created successfully');
  }, [setAuth]);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('enrich_tenant_id');
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, registerWithInvite, logout, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
