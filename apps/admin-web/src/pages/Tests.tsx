import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Test {
  id: string;
  title: string;
  type: string;
  status: string;
  difficulty?: string;
  config: { durationMinutes: number };
}

export default function Tests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadTests = () => {
    setLoading(true);
    api<Test[]>('/tests')
      .then(setTests)
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTests(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete test "${title}"? This cannot be undone.`)) return;
    try {
      await api(`/tests/${id}`, { method: 'DELETE' });
      loadTests();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Tests</h1>
        <button
          onClick={() => navigate('/tests/new')}
          style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
        >
          + Create Test
        </button>
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {tests.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No tests yet. Create your first test to get started.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Difficulty</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Duration</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/tests/${t.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{t.title}</Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{t.type}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {t.difficulty ? (
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: t.difficulty === 'easy' ? '#16a34a22' : t.difficulty === 'medium' ? '#eab30822' : '#ef444422', color: t.difficulty === 'easy' ? '#4ade80' : t.difficulty === 'medium' ? '#fbbf24' : '#f87171' }}>
                        {t.difficulty}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>--</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: t.status === 'published' ? '#16a34a22' : t.status === 'draft' ? '#eab30822' : '#71717a22', color: t.status === 'published' ? '#4ade80' : t.status === 'draft' ? '#fbbf24' : '#a1a1aa' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{t.config.durationMinutes} min</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => navigate(`/tests/${t.id}/edit`)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Edit</button>
                      <button onClick={() => handleDelete(t.id, t.title)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
