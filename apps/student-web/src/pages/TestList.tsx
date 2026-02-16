import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Test {
  id: string;
  title: string;
  type: string;
  status: string;
  config: { durationMinutes: number; attemptLimit: number };
}

export default function TestList() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<Test[]>('/tests')
      .then((data) => setTests(data.filter((t) => t.status === 'published')))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startTest = async (testId: string) => {
    setStarting(testId);
    try {
      const attempt = await api<{ id: string }>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ testId }),
      });
      navigate(`/attempt/${attempt.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start test');
    } finally {
      setStarting(null);
    }
  };

  if (loading) return <div>Loading tests...</div>;
  if (error) return <div style={{ color: '#ef4444' }}>{error}</div>;

  const published = tests.filter((t) => t.status === 'published');

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Available Tests</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Select a test to start your practice or assessment.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {published.length === 0 ? (
          <div
            style={{
              padding: '2rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            No tests available. Check back later.
          </div>
        ) : (
          published.map((test) => (
            <div
              key={test.id}
              style={{
                padding: '1rem 1.5rem',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>{test.title}</h3>
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  {test.type} • {test.config.durationMinutes} min • {test.config.attemptLimit} attempt
                  {test.config.attemptLimit !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => startTest(test.id)}
                disabled={!!starting}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--color-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 500,
                }}
              >
                {starting === test.id ? 'Starting...' : 'Start'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
