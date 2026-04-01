import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import RevisionHistoryModal from '../components/RevisionHistoryModal';

interface Question {
  id: string;
  type: string;
  content: { title: string; defaultWeight?: number };
  difficulty: string;
  tags: string[];
  isArchived?: boolean;
  testQuestions?: { test: { id: string; title: string } }[];
}

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mcq' | 'coding'>('all');
  const [testFilter, setTestFilter] = useState('');
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
      emitToast('error', e instanceof Error ? e.message : 'Archive failed');
    }
  };

  const handleRevoke = async (id: string, title: string) => {
    if (!confirm(`Revoke archive for question "${title}"?`)) return;
    try {
      await api(`/questions/${id}/revoke`, { method: 'PATCH' });
      loadQuestions();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Permanently delete question "${title}"? This cannot be undone.`)) return;
    try {
      await api(`/questions/${id}`, { method: 'DELETE' });
      loadQuestions();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const badgeStyle = (d: string): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem',
    background: d === 'easy' ? '#16a34a22' : d === 'medium' ? '#eab30822' : '#ef444422',
    color: d === 'easy' ? '#4ade80' : d === 'medium' ? '#fbbf24' : '#f87171',
  });
  const longTextCellStyle: React.CSSProperties = {
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.4,
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const allTests = (() => {
    const map = new Map<string, string>();
    for (const q of questions) {
      for (const tq of q.testQuestions ?? []) {
        if (!map.has(tq.test.id)) map.set(tq.test.id, tq.test.title);
      }
    }
    return [...map.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  })();

  const filtered = questions.filter((q) => {
    if (testFilter) {
      const belongsToTest = (q.testQuestions ?? []).some((tq) => tq.test.id === testFilter);
      if (testFilter === '__unassigned__') {
        if ((q.testQuestions ?? []).length > 0) return false;
      } else if (!belongsToTest) return false;
    }
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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'mcq', 'coding'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.35rem 0.75rem', background: filter === f ? 'var(--color-primary)' : 'transparent', color: filter === f ? '#fff' : 'var(--color-text-muted)', border: filter === f ? 'none' : '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.85rem', textTransform: 'uppercase' }}>
            {f}
          </button>
        ))}
        <select
          value={testFilter}
          onChange={(e) => setTestFilter(e.target.value)}
          style={{ padding: '0.35rem 0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: testFilter ? 'var(--color-text)' : 'var(--color-text-muted)', fontSize: '0.85rem', minWidth: 180 }}
        >
          <option value="">All Tests</option>
          <option value="__unassigned__">Unassigned (no test)</option>
          {allTests.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions by title, type, difficulty, tags"
          style={{ width: 420, padding: '0.6rem 0.85rem', background: '#fff', border: '2px solid #d1d5db', borderRadius: 8, color: '#111827', fontWeight: 600 }}
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
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Weight</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Tags</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Used in tests</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeQuestions.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, ...longTextCellStyle }}>{q.content?.title || '(untitled)'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{q.type}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={badgeStyle(q.difficulty)}>{q.difficulty}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{typeof q.content?.defaultWeight === 'number' && Number.isFinite(q.content.defaultWeight) ? q.content.defaultWeight : '--'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{q.tags?.join(', ') || '--'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {(q.testQuestions?.length ?? 0) === 0
                      ? '--'
                      : (q.testQuestions ?? []).map((tq, idx) => (
                          <span key={tq.test.id}>
                            {idx > 0 && ', '}
                            <Link to={`/tests/${tq.test.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{tq.test.title}</Link>
                          </span>
                        ))}
                  </td>
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
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Weight</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Used in tests</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archivedQuestions.map((q) => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, ...longTextCellStyle }}>{q.content?.title || '(untitled)'}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{q.type}</td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{typeof q.content?.defaultWeight === 'number' && Number.isFinite(q.content.defaultWeight) ? q.content.defaultWeight : '--'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    {(q.testQuestions?.length ?? 0) === 0 ? '--' : (q.testQuestions ?? []).map((tq, idx) => (
                      <span key={tq.test.id}>{idx > 0 && ', '}<Link to={`/tests/${tq.test.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{tq.test.title}</Link></span>
                    ))}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleRevoke(q.id, q.content?.title || '(untitled)')} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #22c55e55', borderRadius: 4, color: '#4ade80', fontSize: '0.8rem' }}>Revoke</button>
                      <button onClick={() => handleDelete(q.id, q.content?.title || '(untitled)')} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Delete</button>
                      <button onClick={() => setHistoryTarget({ id: q.id, title: q.content?.title || '(untitled)' })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Revision History</button>
                    </div>
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
