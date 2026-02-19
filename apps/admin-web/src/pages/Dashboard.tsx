import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface DashboardStats {
  tests: number;
  questions: number;
  students: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ tests: 0, questions: 0, students: 0 });

  useEffect(() => {
    api<DashboardStats>('/users/stats')
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: 'Tests', value: stats.tests, to: '/tests' },
    { label: 'Questions', value: stats.questions, to: '/questions' },
    { label: 'Students', value: stats.students, to: '/students' },
  ];

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem' }}>Dashboard</h1>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {cards.map((c) => (
          <div key={c.label} style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, minWidth: 180, flex: '1 1 180px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 600 }}>{c.value}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>{c.label}</div>
            <Link to={c.to} style={{ display: 'inline-block', marginTop: '0.5rem', color: 'var(--color-primary)', textDecoration: 'none' }}>Manage</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
