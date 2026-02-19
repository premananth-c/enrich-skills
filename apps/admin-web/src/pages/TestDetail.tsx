import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

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
  difficulty?: string;
  config: { durationMinutes: number; attemptLimit: number };
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

interface StudentItem {
  id: string;
  name: string;
  email: string;
}

export default function TestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestData | null>(null);
  const [attempts, setAttempts] = useState<AttemptEntry[]>([]);
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

  const loadTest = useCallback(async () => {
    if (!id) return;
    try {
      const [t, a] = await Promise.all([
        api<TestData>(`/tests/${id}`),
        api<AttemptEntry[]>(`/tests/${id}/attempts`).catch(() => [] as AttemptEntry[]),
      ]);
      setTest(t);
      setAttempts(a);
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
        ? { userId: allocStudentId, variantId: allocVariantId || undefined }
        : { email: allocEmail.trim(), variantId: allocVariantId || undefined };
      await api(`/tests/${test.id}/allocations`, { method: 'POST', body: JSON.stringify(body) });
      setAllocateOpen(false);
      loadTest();
    } catch (e) {
      setAllocError(e instanceof Error ? e.message : 'Failed to assign');
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <Link to="/tests" style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>Tests</Link>
          <span style={{ margin: '0 0.4rem', color: 'var(--color-text-muted)' }}>/</span>
          <span style={{ fontWeight: 500 }}>{test.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={openAllocate} style={{ padding: '0.5rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.9rem' }}>
            Assign to Student
          </button>
          <button onClick={() => navigate(`/tests/${test.id}/edit`)} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}>
            Edit Test
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Type</div>
          <div style={{ fontWeight: 500, textTransform: 'uppercase' }}>{test.type}</div>
        </div>
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Status</div>
          <div><span style={badgeStyle(test.status)}>{test.status}</span></div>
        </div>
        {test.difficulty && (
          <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Difficulty</div>
            <div><span style={badgeStyle(test.difficulty)}>{test.difficulty}</span></div>
          </div>
        )}
        <div style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Duration</div>
          <div style={{ fontWeight: 500 }}>{test.config.durationMinutes} min</div>
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
              + Add from Pool
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
          {attempts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No students have attempted this test yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Student</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Score</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Started</th>
                  <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{a.user.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{a.user.email}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={badgeStyle(a.status === 'submitted' || a.status === 'graded' ? 'published' : a.status === 'in_progress' ? 'draft' : 'archived')}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {a.score != null && a.maxScore != null ? `${a.score} / ${a.maxScore}` : '--'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{new Date(a.startedAt).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Question Pool Modal */}
      {poolOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: 600, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Add Questions from Pool</h3>
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
