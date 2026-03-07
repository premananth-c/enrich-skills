import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface) 100%)',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '2rem',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.png" alt="RankerShip" style={{ height: 72, marginBottom: '1rem' }} />
          <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>All the best Ranker</p>
        </div>
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              padding: '0.75rem',
              borderRadius: '6px',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              marginBottom: '1rem',
              fontSize: '1rem',
            }}
          />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              marginBottom: '1.5rem',
              fontSize: '1rem',
            }}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 500,
              opacity: canSubmit ? 1 : 0.65,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            Sign in
          </button>
        </form>
        <p style={{ marginTop: '1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
