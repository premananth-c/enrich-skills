import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import RevisionHistoryModal from '../components/RevisionHistoryModal';

interface Question {
  id: string;
  type: string;
  content: { title: string };
  difficulty: string;
  tags: string[];
  isArchived?: boolean;
}

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mcq' | 'coding'>('all');
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; title: string } | null>(null);
  const navigate = useNavigate();

  const loadQuestions = () => {
    setLoading(true);
    const query = filter !== 'all' ? `?type=${filter}` : '';
    const prefix = query ? `${query}&` : '?';
    api<Question[]>(`/questions${prefix}includeArchived=true`)
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadQuestions(); }, [filter]);

  const handleArchive = async (id: string, title: string) => {
    if (!confirm(`Archive question "${title}"?`)) return;
    try {
      await api(`/questions/${id}/archive`, { method: 'PATCH' });
      loadQuestions();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Archive failed');
    }
  };

  const badgeStyle = (d: string): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem',
    background: d === 'easy' ? '#16a34a22' : d === 'medium' ? '#eab30822' : '#ef444422',
    color: d === 'easy' ? '#4ade80' : d === 'medium' ? '#fbbf24' : '#f87171',
  });

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  const filtered = questions.filter((q) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      (q.content?.title || '').toLowerCase().includes(s) ||
      q.type.toLowerCase().includes(s) ||
      q.difficulty.toLowerCase().includes(s) ||
      (q.tags || []).join(', ').toLowerCase().includes(s)
    );
  });
  const activeQuestions = filtered.filter((q) => !q.isArchived);
  const archivedQuestions = filtered.filter((q) => q.isArchived);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Question Bank</h1>
        <button
          onClick={() => navigate('/questions/new')}
          style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
        >
          + Create Question
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['all', 'mcq', 'coding'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.35rem 0.75rem', background: filter === f ? 'var(--color-primary)' : 'transparent', color: filter === f ? '#fff' : 'var(--color-text-muted)', border: filter === f ? 'none' : '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.85rem', textTransform: 'uppercase' }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions by title, type, difficulty, tags"
          style={{ width: 420, padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)' }}
        />
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {activeQuestions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No questions yet. Create your first question to get started.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Difficulty</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Tags</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeQuestions.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{q.content?.title || '(untitled)'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{q.type}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={badgeStyle(q.difficulty)}>{q.difficulty}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{q.tags?.join(', ') || '--'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => navigate(`/questions/${q.id}/edit`)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Edit</button>
                      <button onClick={() => handleArchive(q.id, q.content?.title || '(untitled)')} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Archive</button>
                      <button onClick={() => setHistoryTarget({ id: q.id, title: q.content?.title || '(untitled)' })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Revision History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <h2 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.05rem' }}>Archived Questions</h2>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {archivedQuestions.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No archived questions.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archivedQuestions.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{q.content?.title || '(untitled)'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{q.type}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <button onClick={() => setHistoryTarget({ id: q.id, title: q.content?.title || '(untitled)' })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Revision History</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {historyTarget && (
        <RevisionHistoryModal
          module="questions"
          entityId={historyTarget.id}
          entityLabel={historyTarget.title}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
