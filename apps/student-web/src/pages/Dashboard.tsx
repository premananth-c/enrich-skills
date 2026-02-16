import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface Attempt {
  id: string;
  test: { title: string };
  score: number | null;
  maxScore: number | null;
  status: string;
  submittedAt: string | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    api<Attempt[]>('/attempts')
      .then(setAttempts)
      .catch(() => setAttempts([]));
  }, []);

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Welcome, {user?.name}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
        Practice coding assessments and mock tests.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <Link
          to="/tests"
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--color-primary)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Browse Tests
        </Link>
      </div>
      {attempts.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Recent Attempts</h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {attempts.map((a) => (
              <Link
                key={a.id}
                to={`/attempt/${a.id}`}
                style={{
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: 'inherit',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span>{a.test.title}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  {a.status === 'submitted' && a.score != null && a.maxScore != null
                    ? `${a.score}/${a.maxScore}`
                    : a.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
