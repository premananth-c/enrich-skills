import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatStatusLabel } from '../lib/status';
import { useAuth } from '../context/AuthContext';

interface QuestionItem {
  id: string;
  type: string;
  content: { title: string };
  difficulty: string;
  tags: string[];
}

interface TestQuestion {
  id: string;
  questionId: string;
  order: number;
  variantId?: string | null;
  question: QuestionItem;
}

interface Variant {
  id: string;
  testId: string;
  name: string;
  difficulty: string;
  testQuestions?: TestQuestion[];
}

interface TestData {
  id: string;
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
    passPercentage?: number;
    scoreDistribution?: 'equal' | 'custom';
    questionWeights?: Record<string, number>;
  };
  schedule?: { startAt: string; endAt: string } | null;
  testQuestions: TestQuestion[];
  variants?: Variant[];
}

interface AttemptEntry {
  id: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  status: string;
  user: { id: string; name: string; email: string };
}

interface StudentAttemptSummary {
  userId: string;
  user: { id: string; name: string; email: string } | null;
  assignedAt: string;
  variantId?: string | null;
  attemptCount: number;
  latestStatus: string;
  latestScore: number | null;
  latestMaxScore: number | null;
  attempts: AttemptEntry[];
}

interface StudentItem {
  id: string;
  name: string;
  email: string;
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
};

function clampNumberInput(raw: string, min: number, max: number, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function buildUpdateSnapshot(input: {
  title: string;
  type: 'mcq' | 'coding';
  status: 'draft' | 'published' | 'archived';
  config: TestData['config'];
  scheduleEnabled: boolean;
  startAt: string;
  endAt: string;
}) {
  return JSON.stringify({
    title: input.title.trim(),
    type: input.type,
    status: input.status,
    config: {
      ...input.config,
      questionWeights: input.config.questionWeights ?? {},
    },
    schedule: input.scheduleEnabled ? { startAt: input.startAt || '', endAt: input.endAt || '' } : null,
  });
}

export default function TestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const [test, setTest] = useState<TestData | null>(null);
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
  const [studentAttempts, setStudentAttempts] = useState<StudentAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [poolOpen, setPoolOpen] = useState(false);
  const [pool, setPool] = useState<QuestionItem[]>([]);
  const [selectedPoolIds, setSelectedPoolIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'questions' | 'students' | 'variants'>('questions');

  // Variant form state
  const [variantFormOpen, setVariantFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [variantName, setVariantName] = useState('');
  const [variantDifficulty, setVariantDifficulty] = useState('easy');

  // Variant question assignment state
  const [assignVariantId, setAssignVariantId] = useState<string | null>(null);
  const [variantQuestionIds, setVariantQuestionIds] = useState<Set<string>>(new Set());

  // Allocate test to student
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [allocStudentId, setAllocStudentId] = useState('');
  const [allocEmail, setAllocEmail] = useState('');
  const [allocVariantId, setAllocVariantId] = useState('');
  const [allocError, setAllocError] = useState('');
  const [allocResetAttempts, setAllocResetAttempts] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'mcq' | 'coding'>('mcq');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [config, setConfig] = useState<TestData['config']>(defaultConfig);
  const [durationInput, setDurationInput] = useState(String(defaultConfig.durationMinutes));
  const [attemptLimitInput, setAttemptLimitInput] = useState(String(defaultConfig.attemptLimit));
  const [passPercentageInput, setPassPercentageInput] = useState(String(defaultConfig.passPercentage ?? 40));
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialUpdateSnapshot, setInitialUpdateSnapshot] = useState('');

  const loadTest = useCallback(async () => {
    if (!id) return;
    try {
      const [t, attemptData] = await Promise.all([
        api<TestData>(`/tests/${id}`),
        api<{ students: StudentAttemptSummary[]; attempts: AttemptEntry[] }>(`/tests/${id}/attempts`).catch(
          () => ({ students: [] as StudentAttemptSummary[], attempts: [] as AttemptEntry[] })
        ),
      ]);
      setTest(t);
      setAttempts(attemptData.attempts);
      setStudentAttempts(attemptData.students);
      setTitle(t.title);
      setType(t.type as 'mcq' | 'coding');
      setStatus(t.status as 'draft' | 'published' | 'archived');
      setConfig({
        ...defaultConfig,
        ...t.config,
        passPercentage: t.config.passPercentage ?? 40,
        scoreDistribution: t.config.scoreDistribution ?? 'equal',
        questionWeights: t.config.questionWeights ?? {},
      });
      setDurationInput(String(t.config.durationMinutes ?? defaultConfig.durationMinutes));
      setAttemptLimitInput(String(t.config.attemptLimit ?? defaultConfig.attemptLimit));
      setPassPercentageInput(String(t.config.passPercentage ?? 40));
      if (t.schedule?.startAt && t.schedule?.endAt) {
        setScheduleEnabled(true);
        setStartAt(t.schedule.startAt.slice(0, 16));
        setEndAt(t.schedule.endAt.slice(0, 16));
      } else {
        setScheduleEnabled(false);
        setStartAt('');
        setEndAt('');
      }
      setInitialUpdateSnapshot(
        buildUpdateSnapshot({
          title: t.title,
          type: t.type as 'mcq' | 'coding',
          status: t.status as 'draft' | 'published' | 'archived',
          config: {
            ...defaultConfig,
            ...t.config,
            passPercentage: t.config.passPercentage ?? 40,
            scoreDistribution: t.config.scoreDistribution ?? 'equal',
            questionWeights: t.config.questionWeights ?? {},
          },
          scheduleEnabled: Boolean(t.schedule?.startAt && t.schedule?.endAt),
          startAt: t.schedule?.startAt?.slice(0, 16) || '',
          endAt: t.schedule?.endAt?.slice(0, 16) || '',
        })
      );
    } catch {
      setTest(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTest(); }, [loadTest]);

  const openPool = async () => {
    const questions = await api<QuestionItem[]>('/questions');
    setPool(questions);
    setSelectedPoolIds(new Set());
    setPoolOpen(true);
  };

  const addFromPool = async () => {
    if (!test || selectedPoolIds.size === 0) return;
    const existingIds = test.testQuestions.map((tq) => tq.questionId);
    const allIds = [...existingIds, ...Array.from(selectedPoolIds).filter((qid) => !existingIds.includes(qid))];
    await api(`/tests/${test.id}`, { method: 'PATCH', body: JSON.stringify({ questionIds: allIds }) });
    setPoolOpen(false);
    loadTest();
  };

  const removeQuestion = async (questionId: string) => {
    if (!test) return;
    const remaining = test.testQuestions.filter((tq) => tq.questionId !== questionId).map((tq) => tq.questionId);
    await api(`/tests/${test.id}`, { method: 'PATCH', body: JSON.stringify({ questionIds: remaining }) });
    loadTest();
  };

  // Variant handlers
  const openVariantForm = (v?: Variant) => {
    if (v) {
      setEditingVariant(v);
      setVariantName(v.name);
      setVariantDifficulty(v.difficulty);
    } else {
      setEditingVariant(null);
      setVariantName('');
      setVariantDifficulty('easy');
    }
    setVariantFormOpen(true);
  };

  const saveVariant = async () => {
    if (!test || !variantName) return;
    if (editingVariant) {
      await api(`/tests/${test.id}/variants/${editingVariant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: variantName, difficulty: variantDifficulty }),
      });
    } else {
      await api(`/tests/${test.id}/variants`, {
        method: 'POST',
        body: JSON.stringify({ name: variantName, difficulty: variantDifficulty }),
      });
    }
    setVariantFormOpen(false);
    loadTest();
  };

  const deleteVariant = async (variantId: string) => {
    if (!test || !confirm('Delete this variant? Questions will be unassigned.')) return;
    await api(`/tests/${test.id}/variants/${variantId}`, { method: 'DELETE' });
    loadTest();
  };

  const openAssignQuestions = (variant: Variant) => {
    setAssignVariantId(variant.id);
    const assigned = test?.testQuestions.filter((tq) => tq.variantId === variant.id).map((tq) => tq.questionId) || [];
    setVariantQuestionIds(new Set(assigned));
  };

  const saveVariantQuestions = async () => {
    if (!test || !assignVariantId) return;
    await api(`/tests/${test.id}/variants/${assignVariantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ questionIds: Array.from(variantQuestionIds) }),
    });
    setAssignVariantId(null);
    loadTest();
  };

  // Allocation handlers
  const openAllocate = async () => {
    const s = await api<StudentItem[]>('/users?role=student');
    setStudents(s);
    setAllocStudentId('');
    setAllocEmail('');
    setAllocVariantId('');
    setAllocError('');
    setAllocResetAttempts(false);
    setAllocateOpen(true);
  };

  const allocateTest = async () => {
    if (!test) return;
    const hasStudent = allocStudentId.trim();
    const hasEmail = allocEmail.trim();
    if (!hasStudent && !hasEmail) {
      setAllocError('Select a student or enter an email address.');
      return;
    }
    setAllocError('');
    try {
      const body = hasStudent
        ? { userId: allocStudentId, variantId: allocVariantId || undefined, resetAttempts: allocResetAttempts }
        : { email: allocEmail.trim(), variantId: allocVariantId || undefined };
      await api(`/tests/${test.id}/allocations`, { method: 'POST', body: JSON.stringify(body) });
      setAllocateOpen(false);
      loadTest();
    } catch (e) {
      setAllocError(e instanceof Error ? e.message : 'Failed to assign');
    }
  };

  const removeStudentFromTest = async (userId: string) => {
    if (!test || !confirm('Remove this student from the test? They will no longer see or attempt this test.')) return;
    setRemovingUserId(userId);
    try {
      await api(`/tests/${test.id}/allocations/${userId}`, { method: 'DELETE' });
      loadTest();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove student');
    } finally {
      setRemovingUserId(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!test) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Test not found.</div>;

  const badgeStyle = (variant: string): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem',
    background: variant === 'published' || variant === 'easy' ? '#16a34a22' : variant === 'draft' || variant === 'medium' ? '#eab30822' : variant === 'hard' ? '#ef444422' : '#71717a22',
    color: variant === 'published' || variant === 'easy' ? '#4ade80' : variant === 'draft' || variant === 'medium' ? '#fbbf24' : variant === 'hard' ? '#f87171' : '#a1a1aa',
  });

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };

  const variants = test.variants || [];
  const isCustomWeights = test.config.scoreDistribution === 'custom';
  const currentUpdateSnapshot = buildUpdateSnapshot({ title, type, status, config, scheduleEnabled, startAt, endAt });
  const isUpdateDirty = currentUpdateSnapshot !== initialUpdateSnapshot;
  const hasRequiredSchedule = !scheduleEnabled || (startAt.length > 0 && endAt.length > 0);
  const canUpdateTest = !saving && title.trim().length >= 2 && hasRequiredSchedule && isUpdateDirty;

  const updateQuestionWeight = async (questionId: string, nextWeight: number) => {
    if (!test) return;
    const weights = { ...(test.config.questionWeights || {}) };
    weights[questionId] = Math.max(0, Number.isFinite(nextWeight) ? nextWeight : 0);
    await api(`/tests/${test.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        config: {
          ...test.config,
          scoreDistribution: 'custom',
          questionWeights: weights,
        },
      }),
    });
    setTest({
      ...test,
      config: {
        ...test.config,
        scoreDistribution: 'custom',
        questionWeights: weights,
      },
    });
  };

  const handleUpdateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test) return;
    setSaveError('');
    setSaving(true);
    try {
      const normalizedConfig: TestData['config'] = {
        ...config,
        durationMinutes: clampNumberInput(durationInput, 1, 480, config.durationMinutes),
        attemptLimit: clampNumberInput(attemptLimitInput, 1, 100, config.attemptLimit),
        passPercentage: clampNumberInput(passPercentageInput, 0, 100, config.passPercentage ?? 40),
      };
      setConfig(normalizedConfig);
      setDurationInput(String(normalizedConfig.durationMinutes));
      setAttemptLimitInput(String(normalizedConfig.attemptLimit));
      setPassPercentageInput(String(normalizedConfig.passPercentage ?? 40));

      const payload: Record<string, unknown> = {
        title,
        type,
        status,
        config: normalizedConfig,
      };
      if (scheduleEnabled && startAt && endAt) {
        payload.schedule = { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() };
      }
      await api(`/tests/${test.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await loadTest();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update test');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    if (!test) return;
    setTitle(test.title);
    setType(test.type as 'mcq' | 'coding');
    setStatus(test.status as 'draft' | 'published' | 'archived');
    setConfig({
      ...defaultConfig,
      ...test.config,
      passPercentage: test.config.passPercentage ?? 40,
      scoreDistribution: test.config.scoreDistribution ?? 'equal',
      questionWeights: test.config.questionWeights ?? {},
    });
    setDurationInput(String(test.config.durationMinutes ?? defaultConfig.durationMinutes));
    setAttemptLimitInput(String(test.config.attemptLimit ?? defaultConfig.attemptLimit));
    setPassPercentageInput(String(test.config.passPercentage ?? 40));
    if (test.schedule?.startAt && test.schedule?.endAt) {
      setScheduleEnabled(true);
      setStartAt(test.schedule.startAt.slice(0, 16));
      setEndAt(test.schedule.endAt.slice(0, 16));
    } else {
      setScheduleEnabled(false);
      setStartAt('');
      setEndAt('');
    }
    setSaveError('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link to="/tests" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>Tests</Link>
          <span style={{ margin: '0 0.4rem', color: 'var(--color-text-muted)' }}>/</span>
          <span style={{ fontWeight: 500 }}>{test.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={openAllocate}
            disabled={!canEdit('tests')}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              color: 'var(--color-text)',
              fontSize: '0.9rem',
              cursor: canEdit('tests') ? 'pointer' : 'not-allowed',
              opacity: canEdit('tests') ? 1 : 0.6,
            }}
          >
            Assign to Student
          </button>
        </div>
      </div>

      <form onSubmit={handleUpdateTest} style={{ marginBottom: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem' }}>Test Configuration</h3>
        {saveError && <div style={{ padding: '0.65rem 0.75rem', marginBottom: '0.75rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171' }}>{saveError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'mcq' | 'coding')} style={inputStyle}>
              <option value="mcq">MCQ</option>
              <option value="coding">Coding</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published' | 'archived')} style={inputStyle}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
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
                  setConfig({ ...config, passPercentage: clampNumberInput(raw, 0, 100, config.passPercentage ?? 40) });
                }
              }}
              onBlur={() => {
                const next = clampNumberInput(passPercentageInput, 0, 100, config.passPercentage ?? 40);
                setConfig({ ...config, passPercentage: next });
                setPassPercentageInput(String(next));
              }}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Score Distribution</label>
            <select value={config.scoreDistribution ?? 'equal'} onChange={(e) => setConfig({ ...config, scoreDistribution: e.target.value as 'equal' | 'custom' })} style={inputStyle}>
              <option value="equal">Equal Distribution</option>
              <option value="custom">Custom Weightage</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          {([
            ['shuffleQuestions', 'Shuffle Questions'],
            ['showResultsImmediately', 'Show Results Immediately'],
            ['partialScoring', 'Partial Scoring'],
            ['proctoringEnabled', 'Proctoring'],
            ['aiFeedbackEnabled', 'AI Feedback'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(config[key as keyof typeof config])} onChange={(e) => setConfig({ ...config, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', cursor: 'pointer', marginBottom: scheduleEnabled ? '0.75rem' : 0 }}>
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
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={!canUpdateTest} style={{ padding: '0.6rem 1.5rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canUpdateTest ? 1 : 0.65, cursor: canUpdateTest ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Saving...' : 'Update Test'}
          </button>
          <button type="button" onClick={resetForm} style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>
            Cancel
          </button>
        </div>
      </form>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Type</div>
          <div style={{ fontWeight: 500, textTransform: 'uppercase' }}>{test.type}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Status</div>
          <div><span style={badgeStyle(test.status)}>{formatStatusLabel(test.status)}</span></div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Duration</div>
          <div style={{ fontWeight: 500 }}>{test.config.durationMinutes} min</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Pass Mark</div>
          <div style={{ fontWeight: 500 }}>{test.config.passPercentage ?? 40}%</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Distribution</div>
          <div style={{ fontWeight: 500 }}>{isCustomWeights ? 'Custom Weightage' : 'Equal'}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Questions</div>
          <div style={{ fontWeight: 500 }}>{test.testQuestions.length}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Variants</div>
          <div style={{ fontWeight: 500 }}>{variants.length}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Attempts</div>
          <div style={{ fontWeight: 500 }}>{attempts.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
        {(['questions', 'variants', 'students'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.5rem 1.25rem', background: 'transparent', border: 'none', borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent', color: tab === t ? 'var(--color-text)' : 'var(--color-text-muted)', fontWeight: 500, textTransform: 'capitalize', cursor: 'pointer' }}>
            {t === 'students' ? `Students & Scores (${attempts.length})` : t === 'variants' ? `Difficulty Variants (${variants.length})` : `Questions (${test.testQuestions.length})`}
          </button>
        ))}
      </div>

      {/* Questions Tab */}
      {tab === 'questions' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={openPool} style={{ padding: '0.4rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.9rem' }}>
              + Add from Question Bank
            </button>
            <button onClick={() => navigate(`/questions/new?testId=${test.id}`)} style={{ padding: '0.4rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.9rem' }}>
              + Create New Question
            </button>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {test.testQuestions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No questions assigned to this test yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem', width: 40 }}>#</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Type</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Difficulty</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Variant</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Weight</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {test.testQuestions.map((tq, i) => {
                    const v = variants.find((v) => v.id === tq.variantId);
                    return (
                      <tr key={tq.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{tq.question.content?.title || '(untitled)'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{tq.question.type}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={badgeStyle(tq.question.difficulty)}>{tq.question.difficulty}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{v ? v.name : 'Default'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={test.config.questionWeights?.[tq.questionId] ?? 1}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (Number.isFinite(value)) void updateQuestionWeight(tq.questionId, value);
                            }}
                            style={{ width: 80, ...inputStyle }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <button onClick={() => removeQuestion(tq.questionId)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Variants Tab */}
      {tab === 'variants' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={() => openVariantForm()} style={{ padding: '0.4rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.9rem' }}>
              + Add Variant
            </button>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Difficulty variants allow different sets of questions for the same test. When a student is assigned to this test, the admin can select which variant they take.
          </p>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {variants.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No difficulty variants defined. All students take the same set of questions.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Name</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Difficulty</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Questions</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => {
                    const qCount = test.testQuestions.filter((tq) => tq.variantId === v.id).length;
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{v.name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}><span style={badgeStyle(v.difficulty)}>{v.difficulty}</span></td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{qCount}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => openAssignQuestions(v)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Assign Qs</button>
                            <button onClick={() => openVariantForm(v)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Edit</button>
                            <button onClick={() => deleteVariant(v.id)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Students Tab */}
      {tab === 'students' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          {studentAttempts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students are assigned to this test yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Student</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Assigned</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Attempts</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Score</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Attempt Timestamps</th>
                  {canEdit('tests') && (
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {studentAttempts.map((s) => (
                  <tr key={s.userId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{s.user?.name ?? 'Unknown'}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{s.user?.email ?? '--'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {new Date(s.assignedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.attemptCount}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={badgeStyle(s.latestStatus === 'submitted' || s.latestStatus === 'graded' ? 'published' : s.latestStatus === 'in_progress' ? 'draft' : 'archived')}>
                        {formatStatusLabel(s.latestStatus)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {s.latestScore != null && s.latestMaxScore != null ? `${s.latestScore} / ${s.latestMaxScore}` : '--'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      {s.attempts.length === 0
                        ? 'No attempts'
                        : s.attempts
                            .map((a, i) => `#${i + 1} ${new Date(a.startedAt).toLocaleString()}${a.submittedAt ? ` -> ${new Date(a.submittedAt).toLocaleString()}` : ''}`)
                            .join(' | ')}
                    </td>
                    {canEdit('tests') && (
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => removeStudentFromTest(s.userId)}
                          disabled={removingUserId === s.userId}
                          style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            border: '1px solid #ef444444',
                            borderRadius: 4,
                            color: '#f87171',
                            fontSize: '0.8rem',
                            cursor: removingUserId === s.userId ? 'wait' : 'pointer',
                            opacity: removingUserId === s.userId ? 0.6 : 1,
                          }}
                        >
                          {removingUserId === s.userId ? 'Removing…' : 'Remove from test'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Question Bank Modal */}
      {poolOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Add Questions from Question Bank</h3>
              <button onClick={() => setPoolOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
              {pool.filter((q) => !test.testQuestions.some((tq) => tq.questionId === q.id)).length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>All questions are already assigned.</div>
              ) : (
                pool.filter((q) => !test.testQuestions.some((tq) => tq.questionId === q.id)).map((q) => (
                  <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedPoolIds.has(q.id)}
                      onChange={(e) => {
                        const next = new Set(selectedPoolIds);
                        if (e.target.checked) next.add(q.id); else next.delete(q.id);
                        setSelectedPoolIds(next);
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{q.content?.title || '(untitled)'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{q.type} &bull; {q.difficulty}{q.tags.length ? ` &bull; ${q.tags.join(', ')}` : ''}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setPoolOpen(false)} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
              <button onClick={addFromPool} disabled={selectedPoolIds.size === 0} style={{ padding: '0.4rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: selectedPoolIds.size === 0 ? 0.5 : 1 }}>
                Add {selectedPoolIds.size} Question{selectedPoolIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Form Modal */}
      {variantFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 400, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>{editingVariant ? 'Edit Variant' : 'Create Variant'}</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Name</label>
              <input value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="e.g. Easy Set" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>Difficulty</label>
              <select value={variantDifficulty} onChange={(e) => setVariantDifficulty(e.target.value)} style={inputStyle}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setVariantFormOpen(false)} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
              <button onClick={saveVariant} disabled={!variantName} style={{ padding: '0.4rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: !variantName ? 0.5 : 1 }}>
                {editingVariant ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Questions to Variant Modal */}
      {assignVariantId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Assign Questions to Variant</h3>
              <button onClick={() => setAssignVariantId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>x</button>
            </div>
            <p style={{ padding: '0.5rem 1.25rem', margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Select which of this test's questions belong to this variant. A question can belong to multiple variants.
            </p>
            <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
              {test.testQuestions.map((tq) => (
                <label key={tq.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={variantQuestionIds.has(tq.questionId)}
                    onChange={(e) => {
                      const next = new Set(variantQuestionIds);
                      if (e.target.checked) next.add(tq.questionId); else next.delete(tq.questionId);
                      setVariantQuestionIds(next);
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{tq.question.content?.title || '(untitled)'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{tq.question.type} &bull; {tq.question.difficulty}</div>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setAssignVariantId(null)} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
              <button onClick={saveVariantQuestions} style={{ padding: '0.4rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}>
                Save ({variantQuestionIds.size} selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Test to Student Modal */}
      {allocateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 400, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem' }}>Assign Test to Student</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Select an existing student or enter an email to invite a new student (an invite will be sent if they have not signed up yet).</p>
            {allocError && <div style={{ padding: '0.5rem', marginBottom: '0.75rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', fontSize: '0.9rem' }}>{allocError}</div>}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Existing student</label>
              <select value={allocStudentId} onChange={(e) => { setAllocStudentId(e.target.value); if (e.target.value) setAllocEmail(''); }} style={inputStyle}>
                <option value="">-- Select Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Or invite by email (new student)</label>
              <input type="email" value={allocEmail} onChange={(e) => setAllocEmail(e.target.value)} placeholder="student@example.com" style={inputStyle} onFocus={() => setAllocStudentId('')} />
            </div>
            {variants.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Difficulty Variant (optional)</label>
                <select value={allocVariantId} onChange={(e) => setAllocVariantId(e.target.value)} style={inputStyle}>
                  <option value="">-- Default (all questions) --</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.difficulty})</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allocResetAttempts}
                  onChange={(e) => setAllocResetAttempts(e.target.checked)}
                  disabled={!allocStudentId}
                />
                Reset previous attempts for this student before reassigning
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setAllocateOpen(false)} style={{ padding: '0.4rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
              <button onClick={allocateTest} disabled={!allocStudentId.trim() && !allocEmail.trim()} style={{ padding: '0.4rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: !allocStudentId.trim() && !allocEmail.trim() ? 0.5 : 1 }}>
                {allocEmail.trim() && !allocStudentId ? 'Send invite & assign' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
