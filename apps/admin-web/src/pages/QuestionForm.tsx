import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

interface McqOption {
  id?: string;
  text: string;
  isCorrect: boolean;
}

interface TestCaseEntry {
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  weight: number;
}

interface QuestionData {
  id: string;
  type: string;
  difficulty: string;
  tags: string[];
  content: {
    title: string;
    description?: string;
    examples?: { input: string; output: string }[];
    constraints?: string[];
    options?: McqOption[];
    explanation?: string;
  };
  testCases?: TestCaseEntry[];
}

export default function QuestionForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const testId = searchParams.get('testId');
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [type, setType] = useState<'mcq' | 'coding'>('mcq');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [tags, setTags] = useState('');
  const [explanation, setExplanation] = useState('');

  // MCQ state
  const [options, setOptions] = useState<McqOption[]>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ]);

  // Coding state
  const [examples, setExamples] = useState<{ input: string; output: string }[]>([{ input: '', output: '' }]);
  const [constraints, setConstraints] = useState('');
  const [testCases, setTestCases] = useState<TestCaseEntry[]>([
    { input: '', expectedOutput: '', isPublic: true, weight: 1 },
  ]);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api<QuestionData>(`/questions/${id}`)
      .then((q) => {
        setType(q.type as 'mcq' | 'coding');
        setTitle(q.content.title);
        setDescription(q.content.description || '');
        setDifficulty(q.difficulty as 'easy' | 'medium' | 'hard');
        setTags(q.tags.join(', '));
        if (q.type === 'mcq') {
          setOptions(q.content.options || [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
          setExplanation(q.content.explanation || '');
        } else {
          setExamples(q.content.examples || [{ input: '', output: '' }]);
          setConstraints((q.content.constraints || []).join('\n'));
          setTestCases(q.testCases || [{ input: '', expectedOutput: '', isPublic: true, weight: 1 }]);
        }
      })
      .catch(() => setError('Failed to load question'))
      .finally(() => setLoading(false));
  }, [id]);

  const addOption = () => setOptions([...options, { text: '', isCorrect: false }]);
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };
  const updateOption = (i: number, changes: Partial<McqOption>) => {
    setOptions(options.map((o, idx) => idx === i ? { ...o, ...changes } : o));
  };
  const setCorrect = (i: number) => {
    setOptions(options.map((o, idx) => ({ ...o, isCorrect: idx === i })));
  };

  const addTestCase = () => setTestCases([...testCases, { input: '', expectedOutput: '', isPublic: false, weight: 1 }]);
  const removeTestCase = (i: number) => {
    if (testCases.length <= 1) return;
    setTestCases(testCases.filter((_, idx) => idx !== i));
  };
  const updateTestCase = (i: number, changes: Partial<TestCaseEntry>) => {
    setTestCases(testCases.map((tc, idx) => idx === i ? { ...tc, ...changes } : tc));
  };

  const addExample = () => setExamples([...examples, { input: '', output: '' }]);
  const removeExample = (i: number) => setExamples(examples.filter((_, idx) => idx !== i));
  const updateExample = (i: number, changes: Partial<{ input: string; output: string }>) => {
    setExamples(examples.map((ex, idx) => idx === i ? { ...ex, ...changes } : ex));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      let created: { id: string } | undefined;
      if (type === 'mcq') {
        const hasCorrect = options.some((o) => o.isCorrect);
        if (!hasCorrect) { setError('At least one option must be marked as correct.'); setSaving(false); return; }
        const payload = {
          title,
          description: description || undefined,
          difficulty,
          tags: tagArr,
          options: options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          explanation: explanation || undefined,
        };
        if (isEdit) {
          await api(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          created = await api<{ id: string }>('/questions/mcq', { method: 'POST', body: JSON.stringify(payload) });
        }
      } else {
        const payload = {
          title,
          description,
          difficulty,
          tags: tagArr,
          examples: examples.filter((ex) => ex.input || ex.output),
          constraints: constraints.split('\n').filter(Boolean),
          testCases,
        };
        if (isEdit) {
          await api(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          created = await api<{ id: string }>('/questions/coding', { method: 'POST', body: JSON.stringify(payload) });
        }
      }

      if (testId && created) {
        const test = await api<{ testQuestions: { questionId: string }[] }>(`/tests/${testId}`);
        const existingIds = test.testQuestions.map((tq) => tq.questionId);
        await api(`/tests/${testId}`, { method: 'PATCH', body: JSON.stringify({ questionIds: [...existingIds, created.id] }) });
        navigate(`/tests/${testId}`);
      } else if (isEdit) {
        navigate('/questions');
      } else {
        navigate('/questions');
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
  const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 80, resize: 'vertical' as const };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 1.5rem' }}>
        {isEdit ? 'Edit Question' : 'Create Question'}
        {testId && !isEdit && <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>(will be added to test)</span>}
      </h1>

      {error && <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {!isEdit && (
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as 'mcq' | 'coding')} style={inputStyle}>
                <option value="mcq">MCQ</option>
                <option value="coding">Coding</option>
              </select>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} style={inputStyle}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Description {type === 'mcq' && '(optional)'}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} {...(type === 'coding' ? { required: true, minLength: 10 } : {})} style={textareaStyle} />
        </div>

        <div>
          <label style={labelStyle}>Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} placeholder="e.g. math, arrays, loops" />
        </div>

        {/* MCQ Section */}
        {type === 'mcq' && (
          <>
            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
              <legend style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>Options</legend>
              <p style={{ margin: '0 0 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Add options and select the correct answer. At least 2 options are required.
              </p>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <input
                    type="radio"
                    name="correctAnswer"
                    checked={opt.isCorrect}
                    onChange={() => setCorrect(i)}
                    title="Mark as correct answer"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <input
                    value={opt.text}
                    onChange={(e) => updateOption(i, { text: e.target.value })}
                    required
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} style={{ background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', padding: '4px 8px', fontSize: '0.8rem' }}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOption} style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                + Add Option
              </button>
            </fieldset>

            <div>
              <label style={labelStyle}>Explanation (optional)</label>
              <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} style={textareaStyle} placeholder="Explain the correct answer..." />
            </div>
          </>
        )}

        {/* Coding Section */}
        {type === 'coding' && (
          <>
            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
              <legend style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>Examples</legend>
              {examples.map((ex, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Input</label>
                    <input value={ex.input} onChange={(e) => updateExample(i, { input: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Output</label>
                    <input value={ex.output} onChange={(e) => updateExample(i, { output: e.target.value })} style={inputStyle} />
                  </div>
                  {examples.length > 1 && (
                    <button type="button" onClick={() => removeExample(i)} style={{ alignSelf: 'flex-end', marginBottom: 2, background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', padding: '4px 8px', fontSize: '0.8rem' }}>x</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addExample} style={{ padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                + Add Example
              </button>
            </fieldset>

            <div>
              <label style={labelStyle}>Constraints (one per line)</label>
              <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} style={textareaStyle} placeholder="-1000 <= a, b <= 1000" />
            </div>

            <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
              <legend style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', padding: '0 0.5rem' }}>Test Cases (at least 1 required)</legend>
              {testCases.map((tc, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 6 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Input</label>
                    <textarea value={tc.input} onChange={(e) => updateTestCase(i, { input: e.target.value })} required style={{ ...inputStyle, minHeight: 50 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Expected Output</label>
                    <textarea value={tc.expectedOutput} onChange={(e) => updateTestCase(i, { expectedOutput: e.target.value })} required style={{ ...inputStyle, minHeight: 50 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 80 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={tc.isPublic} onChange={(e) => updateTestCase(i, { isPublic: e.target.checked })} /> Public
                    </label>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Weight</label>
                    <input type="number" min={0} max={100} value={tc.weight} onChange={(e) => updateTestCase(i, { weight: +e.target.value })} style={{ ...inputStyle, width: 60 }} />
                  </div>
                  {testCases.length > 1 && (
                    <button type="button" onClick={() => removeTestCase(i)} style={{ background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', padding: '4px 8px', fontSize: '0.8rem' }}>x</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addTestCase} style={{ padding: '0.35rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                + Add Test Case
              </button>
            </fieldset>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.5rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update Question' : 'Create Question'}
          </button>
          <button type="button" onClick={() => navigate(testId ? `/tests/${testId}` : '/questions')} style={{ padding: '0.6rem 1.5rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
