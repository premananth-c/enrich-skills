import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Dashboard() {
  const [stats, setStats] = useState<{ tests: number; questions: number }>({ tests: 0, questions: 0 });

  useEffect(() => {
    Promise.all([api<unknown[]>('/tests'), api<unknown[]>('/questions')])
      .then(([tests, questions]) => setStats({ tests: tests.length, questions: questions.length }))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Dashboard</h1>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, minWidth: 180 }}>
          <div style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.tests}</div>
          <div style={{ color: 'var(--color-text-muted)' }}>Tests</div>
          <Link to="/tests" style={{ display: 'inline-block', marginTop: '0.5rem', color: 'var(--color-primary)' }}>Manage</Link>
        </div>
        <div style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, minWidth: 180 }}>
          <div style={{ fontSize: '2rem', fontWeight: 600 }}>{stats.questions}</div>
          <div style={{ color: 'var(--color-text-muted)' }}>Questions</div>
          <Link to="/questions" style={{ display: 'inline-block', marginTop: '0.5rem', color: 'var(--color-primary)' }}>Manage</Link>
        </div>
      </div>
    </div>
  );
}
