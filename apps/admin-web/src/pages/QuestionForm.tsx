import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CODING_LANGUAGE_IDS, CODING_LANGUAGE_LABELS } from '../lib/codingLanguages';
import { api } from '../lib/api';

interface McqOption {
  id?: string;
  text: string;
  isCorrect: boolean;
}

type TestCaseMatchMode = 'exact' | 'json-orderless';

interface TestCaseEntry {
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  weight: number;
  outputMatchMode: TestCaseMatchMode;
}

interface QuestionData {
  id: string;
  type: string;
  difficulty: string;
  tags: string[];
  content: {
    title: string;
    description?: string;
    codingLanguage?: string;
    examples?: { input: string; output: string }[];
    constraints?: string[];
    options?: McqOption[];
    explanation?: string;
    defaultWeight?: number;
    starterCode?: string;
  };
  testCases?: (TestCaseEntry & { outputMatchMode?: string })[];
}

function buildQuestionSnapshot(input: {
  type: 'mcq' | 'coding';
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string;
  explanation: string;
  options: McqOption[];
  examples: { input: string; output: string }[];
  constraints: string;
  testCases: TestCaseEntry[];
  defaultWeight: number | '';
  codingLanguage?: string;
  starterCode?: string;
}) {
  return JSON.stringify({
    type: input.type,
    title: input.title,
    description: input.description,
    difficulty: input.difficulty,
    tags: input.tags,
    explanation: input.explanation,
    options: input.options,
    examples: input.examples,
    constraints: input.constraints,
    testCases: input.testCases,
    defaultWeight: input.defaultWeight === '' ? undefined : input.defaultWeight,
    ...(input.type === 'coding' ? { codingLanguage: input.codingLanguage ?? '', starterCode: input.starterCode ?? '' } : {}),
  });
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
  const [defaultWeight, setDefaultWeight] = useState<number | ''>(1);

  // MCQ state
  const [options, setOptions] = useState<McqOption[]>([
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ]);

  // Coding state
  const [examples, setExamples] = useState<{ input: string; output: string }[]>([{ input: '', output: '' }]);
  const [constraints, setConstraints] = useState('');
  const [testCases, setTestCases] = useState<TestCaseEntry[]>([
    { input: '', expectedOutput: '', isPublic: true, weight: 1, outputMatchMode: 'exact' },
  ]);
  const [codingLanguage, setCodingLanguage] = useState('typescript');
  const [starterCode, setStarterCode] = useState('');
  const [linkedTest, setLinkedTest] = useState<{ type: string; codingLanguage?: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState('');

  useEffect(() => {
    if (!testId || id) return;
    api<{ type: string; config: { codingLanguage?: string } }>(`/tests/${testId}`)
      .then((t) => {
        setLinkedTest({ type: t.type, codingLanguage: t.config.codingLanguage });
        if (t.type === 'coding' && t.config.codingLanguage) {
          setType('coding');
          setCodingLanguage(t.config.codingLanguage);
        }
      })
      .catch(() => setLinkedTest(null));
  }, [testId, id]);

  useEffect(() => {
    if (!id) return;
    api<QuestionData>(`/questions/${id}`)
      .then((q) => {
        setType(q.type as 'mcq' | 'coding');
        setTitle(q.content.title);
        setDescription(q.content.description || '');
        setDifficulty(q.difficulty as 'easy' | 'medium' | 'hard');
        setTags(q.tags.join(', '));
        setDefaultWeight(typeof q.content.defaultWeight === 'number' && Number.isFinite(q.content.defaultWeight) ? q.content.defaultWeight : 1);
        if (q.type === 'mcq') {
          setOptions(q.content.options || [{ text: '', isCorrect: true }, { text: '', isCorrect: false }]);
          setExplanation(q.content.explanation || '');
        } else {
          setExamples(q.content.examples || [{ input: '', output: '' }]);
          setConstraints((q.content.constraints || []).join('\n'));
          setTestCases(
            (q.testCases || [{ input: '', expectedOutput: '', isPublic: true, weight: 1, outputMatchMode: 'exact' as const }]).map((tc) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isPublic: tc.isPublic,
              weight: tc.weight,
              outputMatchMode: 'outputMatchMode' in tc && tc.outputMatchMode === 'json-orderless' ? 'json-orderless' : 'exact',
            }))
          );
          setCodingLanguage(q.content.codingLanguage ?? 'python');
          setStarterCode(q.content.starterCode ?? '');
        }
        setInitialSnapshot(
          buildQuestionSnapshot({
            type: q.type as 'mcq' | 'coding',
            title: q.content.title,
            description: q.content.description || '',
            difficulty: q.difficulty as 'easy' | 'medium' | 'hard',
            tags: q.tags.join(', '),
            explanation: q.content.explanation || '',
            options: q.content.options || [{ text: '', isCorrect: true }, { text: '', isCorrect: false }],
            examples: q.content.examples || [{ input: '', output: '' }],
            constraints: (q.content.constraints || []).join('\n'),
            testCases: (q.testCases || [{ input: '', expectedOutput: '', isPublic: true, weight: 1, outputMatchMode: 'exact' as const }]).map((tc) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isPublic: tc.isPublic,
              weight: tc.weight,
              outputMatchMode: 'outputMatchMode' in tc && tc.outputMatchMode === 'json-orderless' ? 'json-orderless' : 'exact',
            })),
            defaultWeight: typeof q.content.defaultWeight === 'number' && Number.isFinite(q.content.defaultWeight) ? q.content.defaultWeight : 1,
            ...(q.type === 'coding' ? { codingLanguage: q.content.codingLanguage ?? 'python', starterCode: q.content.starterCode ?? '' } : {}),
          })
        );
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

  const addTestCase = () =>
    setTestCases([...testCases, { input: '', expectedOutput: '', isPublic: false, weight: 1, outputMatchMode: 'exact' }]);
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
          ...(defaultWeight !== '' && Number.isFinite(Number(defaultWeight)) && { defaultWeight: Number(defaultWeight) }),
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
          codingLanguage,
          examples: examples.filter((ex) => ex.input || ex.output),
          constraints: constraints.split('\n').filter(Boolean),
          testCases,
          ...(defaultWeight !== '' && Number.isFinite(Number(defaultWeight)) && { defaultWeight: Number(defaultWeight) }),
          ...(starterCode.trim() && { starterCode: starterCode }),
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
  const currentSnapshot = buildQuestionSnapshot({
    type,
    title,
    description,
    difficulty,
    tags,
    explanation,
    options,
    examples,
    constraints,
    testCases,
    defaultWeight,
    ...(type === 'coding' ? { codingLanguage, starterCode } : {}),
  });
  const isDirty = !isEdit || currentSnapshot !== initialSnapshot;
  const hasCorrect = options.some((o) => o.isCorrect);
  const hasRequiredForCreate = type === 'mcq'
    ? title.trim().length >= 2 && options.length >= 2 && options.every((o) => o.text.trim().length > 0) && hasCorrect
    : title.trim().length >= 2 && description.trim().length >= 10 && testCases.length > 0 && testCases.every((tc) => tc.input.trim().length > 0 && tc.expectedOutput.trim().length > 0) && Boolean(codingLanguage);
  const lockTypeForLinkedCodingTest = Boolean(testId && !isEdit && linkedTest?.type === 'coding');
  const lockCodingLanguageForLinkedTest = Boolean(
    testId && !isEdit && linkedTest?.type === 'coding' && linkedTest.codingLanguage
  );
  const canSubmit = !saving && hasRequiredForCreate && isDirty;

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
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'mcq' | 'coding')}
                disabled={lockTypeForLinkedCodingTest}
                style={inputStyle}
              >
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
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Enter the full question text…" />
        </div>

        <div>
          <label style={labelStyle}>Description {type === 'mcq' && '(optional)'}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} {...(type === 'coding' ? { required: true, minLength: 10 } : {})} style={textareaStyle} />
        </div>

        <div>
          <label style={labelStyle}>Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} placeholder="e.g. math, arrays, loops" />
        </div>

        <div>
          <label style={labelStyle}>Weight (optional)</label>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
            <input
              type="number"
              min={0}
              step={0.5}
              value={defaultWeight === '' || !Number.isFinite(Number(defaultWeight)) ? '' : defaultWeight}
              onChange={(e) => {
                const v = e.target.value;
                setDefaultWeight(v === '' ? '' : Number(v));
              }}
              placeholder="Default for tests"
              style={{ ...inputStyle, width: 52, flexShrink: 0 }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', paddingTop: '0.5rem', flex: 1 }}>Used when this question is in a test with custom weightage. Each test can override this.</span>
          </div>
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
            <div>
              <label style={labelStyle}>Coding language</label>
              <select
                value={codingLanguage}
                onChange={(e) => setCodingLanguage(e.target.value)}
                disabled={lockCodingLanguageForLinkedTest}
                required
                style={inputStyle}
              >
                {CODING_LANGUAGE_IDS.map((lid) => (
                  <option key={lid} value={lid}>
                    {CODING_LANGUAGE_LABELS[lid]}
                  </option>
                ))}
              </select>
              {lockCodingLanguageForLinkedTest && (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Matches this test&apos;s coding language.
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Starter Code (optional)</label>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                Pre-filled code shown in the student's editor. Use this to provide the function signature they must implement.
                For stdin-based languages (Python, Java, C, C++), include the I/O boilerplate.
                For append-based languages (JS, TS), provide the function stub that test cases will call.
              </p>
              <textarea
                value={starterCode}
                onChange={(e) => setStarterCode(e.target.value)}
                style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: '0.88rem', resize: 'vertical' as const, whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' }}
                placeholder={`e.g.\nfunction twoSum(nums, target) {\n  // your code here\n}`}
                spellCheck={false}
              />
            </div>
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
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
                Use <strong>JSON (order ignored)</strong> for problems like grouped anagrams: expected output must be valid JSON, and tell students to print{' '}
                <code style={{ fontSize: '0.78rem' }}>JSON.stringify(...)</code> so stdout parses as JSON (not Node&apos;s default array formatting).
              </p>
              {testCases.map((tc, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 6, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Input</label>
                    <textarea value={tc.input} onChange={(e) => updateTestCase(i, { input: e.target.value })} required style={{ ...inputStyle, minHeight: 50 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Expected Output</label>
                    <textarea value={tc.expectedOutput} onChange={(e) => updateTestCase(i, { expectedOutput: e.target.value })} required style={{ ...inputStyle, minHeight: 50 }} />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Match</label>
                    <select
                      value={tc.outputMatchMode}
                      onChange={(e) => updateTestCase(i, { outputMatchMode: e.target.value as TestCaseMatchMode })}
                      style={inputStyle}
                    >
                      <option value="exact">Exact text</option>
                      <option value="json-orderless">JSON (order ignored)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 80 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={tc.isPublic} onChange={(e) => updateTestCase(i, { isPublic: e.target.checked })} /> Public
                    </label>
                    <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Weight</label>
                    <input type="number" min={0} max={100} value={tc.weight} onChange={(e) => updateTestCase(i, { weight: +e.target.value })} style={{ ...inputStyle, width: 52 }} />
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
          <button type="submit" disabled={!canSubmit} style={{ padding: '0.6rem 1.5rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canSubmit ? 1 : 0.65, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
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
