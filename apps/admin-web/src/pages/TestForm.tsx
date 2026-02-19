import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface TestData {
  id?: string;
  title: string;
  type: string;
  status: string;
  difficulty: string;
  config: {
    durationMinutes: number;
    attemptLimit: number;
    shuffleQuestions: boolean;
    showResultsImmediately: boolean;
    partialScoring: boolean;
    proctoringEnabled: boolean;
    aiFeedbackEnabled: boolean;
  };
  schedule?: { startAt: string; endAt: string } | null;
  testQuestions?: { questionId: string; question: { id: string; content: { title: string }; type: string; difficulty: string } }[];
}

const defaultConfig = {
  durationMinutes: 60,
  attemptLimit: 3,
  shuffleQuestions: false,
  showResultsImmediately: true,
  partialScoring: true,
  proctoringEnabled: false,
  aiFeedbackEnabled: false,
};

export default function TestForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('mcq');
  const [status, setStatus] = useState('draft');
  const [difficulty, setDifficulty] = useState('');
  const [config, setConfig] = useState(defaultConfig);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api<TestData>(`/tests/${id}`)
      .then((t) => {
        setTitle(t.title);
        setType(t.type);
        setStatus(t.status);
        setDifficulty(t.difficulty || '');
        setConfig({ ...defaultConfig, ...t.config });
        if (t.schedule) {
          setScheduleEnabled(true);
          setStartAt(t.schedule.startAt?.slice(0, 16) || '');
          setEndAt(t.schedule.endAt?.slice(0, 16) || '');
        }
      })
      .catch(() => setError('Failed to load test'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        title,
        type,
        config,
        ...(difficulty && { difficulty }),
      };
      if (scheduleEnabled && startAt && endAt) {
        payload.schedule = { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() };
      }
      if (isEdit) {
        payload.status = status;
        await api(`/tests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        navigate(`/tests/${id}`);
      } else {
        const created = await api<{ id: string }>('/tests', { method: 'POST', body: JSON.stringify(payload) });
        navigate(`/tests/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 1.5rem' }}>{isEdit ? 'Edit Test' : 'Create Test'}</h1>
      {error && <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              <option value="mcq">MCQ</option>
              <option value="coding">Coding</option>
            </select>
          </div>
          {isEdit && (
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={inputStyle}>
              <option value="">-- None --</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <legend style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>Configuration</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Duration (minutes)</label>
              <input type="number" min={1} max={480} value={config.durationMinutes} onChange={(e) => setConfig({ ...config, durationMinutes: +e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Attempt Limit</label>
              <input type="number" min={1} max={100} value={config.attemptLimit} onChange={(e) => setConfig({ ...config, attemptLimit: +e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
            {([
              ['shuffleQuestions', 'Shuffle Questions'],
              ['showResultsImmediately', 'Show Results Immediately'],
              ['partialScoring', 'Partial Scoring'],
              ['proctoringEnabled', 'Proctoring'],
              ['aiFeedbackEnabled', 'AI Feedback'],
            ] as const).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={config[key as keyof typeof config] as boolean} onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <legend style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>Schedule (optional)</legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
            <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
            Enable schedule
          </label>
          {scheduleEnabled && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Start</label>
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>End</label>
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}
        </fieldset>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.5rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Test' : 'Create Test'}
          </button>
          <button type="button" onClick={() => navigate(isEdit ? `/tests/${id}` : '/tests')} style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
