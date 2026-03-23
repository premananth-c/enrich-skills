import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CODING_LANGUAGE_IDS, CODING_LANGUAGE_LABELS } from '../lib/codingLanguages';
import { api } from '../lib/api';

interface TestData {
  id?: string;
  title: string;
  type: string;
  status: string;
  config: {
    durationMinutes: number;
    attemptLimit: number;
    shuffleQuestions: boolean;
    showResultsImmediately: boolean;
    partialScoring: boolean;
    proctoringEnabled: boolean;
    aiFeedbackEnabled: boolean;
    passPercentage: number;
    scoreDistribution: 'equal' | 'custom';
    questionWeights?: Record<string, number>;
    restrictBrowserDuringTest: boolean;
    codingLanguage?: string;
  };
  schedule?: { startAt: string; endAt: string } | null;
  testQuestions?: { questionId: string; question: { id: string; content: { title: string }; type: string; difficulty: string } }[];
}

const defaultConfig: TestData['config'] = {
  durationMinutes: 60,
  attemptLimit: 3,
  shuffleQuestions: false,
  showResultsImmediately: true,
  partialScoring: true,
  proctoringEnabled: false,
  aiFeedbackEnabled: false,
  passPercentage: 40,
  scoreDistribution: 'equal',
  questionWeights: {},
  restrictBrowserDuringTest: false,
};

function clampNumberInput(raw: string, min: number, max: number, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildFormSnapshot(input: {
  title: string;
  type: string;
  status: string;
  config: TestData['config'];
  scheduleEnabled: boolean;
  startAt: string;
  endAt: string;
}) {
  const normalized = {
    title: input.title.trim(),
    type: input.type,
    status: input.status,
    config: {
      ...input.config,
      questionWeights: input.config.questionWeights ?? {},
    },
    schedule: input.scheduleEnabled ? { startAt: input.startAt || '', endAt: input.endAt || '' } : null,
  };
  return JSON.stringify(normalized);
}

export default function TestForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('mcq');
  const [status, setStatus] = useState('draft');
  const [config, setConfig] = useState(defaultConfig);
  const [durationInput, setDurationInput] = useState(String(defaultConfig.durationMinutes));
  const [attemptLimitInput, setAttemptLimitInput] = useState(String(defaultConfig.attemptLimit));
  const [passPercentageInput, setPassPercentageInput] = useState(String(defaultConfig.passPercentage));
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState('');

  useEffect(() => {
    if (!id) return;
    api<TestData>(`/tests/${id}`)
      .then((t) => {
        setTitle(t.title);
        setType(t.type);
        setStatus(t.status);
        setConfig({ ...defaultConfig, ...t.config });
        setDurationInput(String(t.config.durationMinutes ?? defaultConfig.durationMinutes));
        setAttemptLimitInput(String(t.config.attemptLimit ?? defaultConfig.attemptLimit));
        setPassPercentageInput(String(t.config.passPercentage ?? defaultConfig.passPercentage));
        if (t.schedule) {
          setScheduleEnabled(true);
          setStartAt(t.schedule.startAt?.slice(0, 16) || '');
          setEndAt(t.schedule.endAt?.slice(0, 16) || '');
        }
        const configWithDefaults = { ...defaultConfig, ...t.config };
        setInitialSnapshot(
          buildFormSnapshot({
            title: t.title,
            type: t.type,
            status: t.status,
            config: configWithDefaults,
            scheduleEnabled: Boolean(t.schedule),
            startAt: t.schedule?.startAt?.slice(0, 16) || '',
            endAt: t.schedule?.endAt?.slice(0, 16) || '',
          })
        );
      })
      .catch(() => setError('Failed to load test'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const normalizedConfig: TestData['config'] = {
        ...config,
        durationMinutes: clampNumberInput(durationInput, 1, 480, config.durationMinutes),
        attemptLimit: clampNumberInput(attemptLimitInput, 1, 100, config.attemptLimit),
        passPercentage: clampNumberInput(passPercentageInput, 0, 100, config.passPercentage),
      };
      setConfig(normalizedConfig);
      setDurationInput(String(normalizedConfig.durationMinutes));
      setAttemptLimitInput(String(normalizedConfig.attemptLimit));
      setPassPercentageInput(String(normalizedConfig.passPercentage));

      const payload: Record<string, unknown> = {
        title,
        type,
        config: normalizedConfig,
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
  const currentSnapshot = buildFormSnapshot({ title, type, status, config, scheduleEnabled, startAt, endAt });
  const isDirty = !isEdit || currentSnapshot !== initialSnapshot;
  const hasRequiredSchedule = !scheduleEnabled || (startAt.length > 0 && endAt.length > 0);
  const canSubmit =
    !saving &&
    title.trim().length >= 2 &&
    hasRequiredSchedule &&
    isDirty &&
    (type !== 'coding' || Boolean(config.codingLanguage));

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 1.5rem' }}>{isEdit ? 'Edit Test' : 'Create Test'}</h1>
      {error && <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Type</label>
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value;
                setType(next);
                if (next === 'coding' && !config.codingLanguage) {
                  setConfig((c) => ({ ...c, codingLanguage: 'typescript' }));
                }
              }}
              style={inputStyle}
            >
              <option value="mcq">MCQ</option>
              <option value="coding">Coding</option>
            </select>
          </div>
          {type === 'coding' && (
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Coding language</label>
              <select
                value={config.codingLanguage ?? 'typescript'}
                onChange={(e) => setConfig((c) => ({ ...c, codingLanguage: e.target.value }))}
                required
                style={inputStyle}
              >
                {CODING_LANGUAGE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CODING_LANGUAGE_LABELS[id]}
                  </option>
                ))}
              </select>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Students only see coding questions tagged with this language; they cannot change language during the test.
              </p>
            </div>
          )}
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
        </div>

        <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <legend style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>Configuration</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Duration (minutes)</label>
              <input
                type="number"
                min={1}
                max={480}
                value={durationInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDurationInput(raw);
                  if (raw === '') return;
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    setConfig({ ...config, durationMinutes: clampNumberInput(raw, 1, 480, config.durationMinutes) });
                  }
                }}
                onBlur={() => {
                  const next = clampNumberInput(durationInput, 1, 480, config.durationMinutes);
                  setConfig({ ...config, durationMinutes: next });
                  setDurationInput(String(next));
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Attempt Limit</label>
              <input
                type="number"
                min={1}
                max={100}
                value={attemptLimitInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setAttemptLimitInput(raw);
                  if (raw === '') return;
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    setConfig({ ...config, attemptLimit: clampNumberInput(raw, 1, 100, config.attemptLimit) });
                  }
                }}
                onBlur={() => {
                  const next = clampNumberInput(attemptLimitInput, 1, 100, config.attemptLimit);
                  setConfig({ ...config, attemptLimit: next });
                  setAttemptLimitInput(String(next));
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Minimum Pass Percentage</label>
              <input
                type="number"
                min={0}
                max={100}
                value={passPercentageInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPassPercentageInput(raw);
                  if (raw === '') return;
                  const parsed = Number(raw);
                  if (Number.isFinite(parsed)) {
                    setConfig({ ...config, passPercentage: clampNumberInput(raw, 0, 100, config.passPercentage) });
                  }
                }}
                onBlur={() => {
                  const next = clampNumberInput(passPercentageInput, 0, 100, config.passPercentage);
                  setConfig({ ...config, passPercentage: next });
                  setPassPercentageInput(String(next));
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Score Distribution</label>
              <select
                value={config.scoreDistribution}
                onChange={(e) => setConfig({ ...config, scoreDistribution: e.target.value as 'equal' | 'custom' })}
                style={inputStyle}
              >
                <option value="equal">Equal Distribution</option>
                <option value="custom">Custom Weightage</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
            {([
              ['shuffleQuestions', 'Shuffle Questions'],
              ['showResultsImmediately', 'Show Results Immediately'],
              ['partialScoring', 'Partial Scoring'],
              ['proctoringEnabled', 'Proctoring'],
              ['aiFeedbackEnabled', 'AI Feedback'],
              ['restrictBrowserDuringTest', 'Restrict Browser During Test'],
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
          <button type="submit" disabled={!canSubmit} style={{ padding: '0.6rem 1.5rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canSubmit ? 1 : 0.65, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
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
