import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Test {
  id: string;
  title: string;
  type: string;
  status: string;
  config: { durationMinutes: number };
}

export default function Tests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Test[]>('/tests')
      .then(setTests)
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Tests</h1>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {tests.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No tests yet.</div>
        ) : (
          tests.map((t) => (
            <div key={t.id} style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{t.title}</strong>
                <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{t.type} • {t.status} • {t.config.durationMinutes} min</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
