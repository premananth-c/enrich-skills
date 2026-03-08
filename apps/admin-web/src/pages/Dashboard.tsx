import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface DashboardStats {
  tests: number;
  questions: number;
  students: number;
}

export default function Dashboard() {
  const { hasNoModuleAccess } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ tests: 0, questions: 0, students: 0 });
  const [batchesCount, setBatchesCount] = useState(0);
  const [coursesCount, setCoursesCount] = useState(0);

  useEffect(() => {
    if (hasNoModuleAccess) return;
    api<DashboardStats>('/users/stats')
      .then(setStats)
      .catch(() => {});
  }, [hasNoModuleAccess]);

  useEffect(() => {
    if (hasNoModuleAccess) return;
    api<unknown[]>('/batches').then((b) => setBatchesCount(b.length)).catch(() => {});
    api<unknown[]>('/courses').then((c) => setCoursesCount(c.length)).catch(() => {});
  }, [hasNoModuleAccess]);

  if (hasNoModuleAccess) {
    return (
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ margin: '0 0 1rem' }}>Dashboard</h1>
        <div style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)' }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            No access provided yet. This is usual, you have successfully logged in as Admin. Please change your password and request your Super Admin to assign permissions.
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Courses', value: coursesCount, to: '/courses' },
    { label: 'Batches', value: batchesCount, to: '/batches' },
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
