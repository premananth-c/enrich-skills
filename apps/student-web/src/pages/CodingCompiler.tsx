import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import CountdownTimer from '../components/CountdownTimer';
import BrowserRestrictionOverlay from '../components/BrowserRestrictionOverlay';
import { useBrowserRestriction } from '../hooks/useBrowserRestriction';
import type { CodingLanguageId } from '../lib/codingLanguages';
import {
  CODING_LANGUAGE_IDS,
  CODING_LANGUAGE_LABELS,
  DEFAULT_CODE_TEMPLATES,
  monacoLanguageForCodingId,
} from '../lib/codingLanguagesUi';

function defaultCodeForLang(lang: string): string {
  return DEFAULT_CODE_TEMPLATES[lang as CodingLanguageId] ?? DEFAULT_CODE_TEMPLATES.python;
}

interface Question {
  id: string;
  type: string;
  content: {
    title: string;
    description: string;
    examples?: { input: string; output: string }[];
    constraints?: string[];
  };
  testCases?: { input: string; expectedOutput: string; isPublic: boolean }[];
}

interface Submission {
  id: string;
  questionId: string;
  code?: string;
  language?: string;
  status: string;
  score?: number;
}

interface AttemptData {
  id: string;
  startedAt: string;
  test: {
    title: string;
    config: {
      durationMinutes: number;
      showResultsPerQuestion?: boolean;
      showResultsImmediately?: boolean;
      restrictBrowserDuringTest?: boolean;
      codingLanguage?: string;
    };
    testQuestions: { question: Question; order: number }[];
  };
  status: string;
  submissions: Submission[];
}

interface RunResult {
  testCaseId: string;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  stderr: string;
  executionTimeMs: number;
  timedOut: boolean;
}

export default function CodingCompiler() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const courseNav = (location.state as { fromCourse?: string; fromTopic?: string } | null) ?? {};
  const fromCourseId = courseNav.fromCourse;
  const fromTopicId = courseNav.fromTopic;
  const questionIndexParam = searchParams.get('q');
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(questionIndexParam ? parseInt(questionIndexParam) : 0);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<RunResult[] | null>(null);
  const [output, setOutput] = useState('');
  const [problemCollapsed, setProblemCollapsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);

  const restrictBrowser = attempt?.test?.config?.restrictBrowserDuringTest === true && attempt?.status === 'in_progress';
  const restriction = useBrowserRestriction({ enabled: restrictBrowser });

  useEffect(() => {
    if (restrictBrowser && !document.fullscreenElement) {
      restriction.requestFullscreen();
    }
  }, [restrictBrowser, restriction.requestFullscreen]);

  useEffect(() => {
    if (!attemptId) return;
    api<AttemptData>(`/attempts/${attemptId}`).then((data) => {
      setAttempt(data);
      const codingQuestions = data.test.testQuestions.filter((tq) => tq.question.type === 'coding');
      const idx = Math.min(currentIdx, codingQuestions.length - 1);
      setCurrentIdx(idx >= 0 ? idx : 0);
      const q = codingQuestions[idx >= 0 ? idx : 0];
      if (q) {
        const sub = data.submissions.find((s) => s.questionId === q.question.id);
        const locked = data.test.config?.codingLanguage;
        const lang = locked || sub?.language || 'python';
        setCode(sub?.code || defaultCodeForLang(lang));
        setLanguage(lang);
      }
    });
  }, [attemptId]);

  const codingQuestions =
    attempt?.test.testQuestions.filter((tq) => tq.question.type === 'coding') || [];

  const current = codingQuestions[currentIdx];
  const qId = current?.question.id || '';
  const content = current?.question.content;
  const submission = attempt?.submissions.find((s) => s.questionId === qId);

  useEffect(() => {
    if (!current || !attempt) return;
    const sub = attempt.submissions.find((s) => s.questionId === current.question.id);
    const locked = attempt.test.config?.codingLanguage;
    const lang = locked || sub?.language || language;
    setCode(sub?.code || defaultCodeForLang(lang));
    setLanguage(lang);
    setRunResults(null);
    setOutput('');
    setSubmissionStatus(sub?.status || null);
  }, [currentIdx, current?.question.id, attempt?.test.config?.codingLanguage]);

  const startPolling = useCallback((attemptId: string, questionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api<{ status: string; score?: number; output?: string; errorMessage?: string }>(
          `/attempts/${attemptId}/submission-status/${questionId}`
        );
        setSubmissionStatus(res.status);
        if (res.status !== 'pending' && res.status !== 'running') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (res.output) setOutput(res.output);
          if (res.errorMessage) setOutput((prev) => prev + '\n' + res.errorMessage);
          setAttempt((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              submissions: prev.submissions.map((s) =>
                s.questionId === questionId ? { ...s, status: res.status, score: res.score ?? s.score } : s
              ),
            };
          });
        }
      } catch { /* ignore */ }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleRun = async () => {
    if (!attemptId || !qId || running) return;
    setRunning(true);
    setRunResults(null);
    setOutput('');
    try {
      const res = await api<{ results: RunResult[] }>(`/attempts/${attemptId}/run-code`, {
        method: 'POST',
        body: JSON.stringify({ questionId: qId, code, language }),
      });
      setRunResults(res.results);
      const passed = res.results.filter((r) => r.passed).length;
      setOutput(`Sample: ${passed}/${res.results.length} passed`);
    } catch (e) {
      setOutput(`Run error: ${e instanceof Error ? e.message : 'Failed'}`);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!attemptId || !qId || submitting) return;
    setSubmitting(true);
    setOutput('');
    setSubmissionStatus('pending');
    try {
      await api(`/attempts/${attemptId}/submit-code`, {
        method: 'POST',
        body: JSON.stringify({ questionId: qId, code, language }),
      });
      setOutput('Code submitted. Evaluating...');
      startPolling(attemptId, qId);
    } catch (e) {
      setOutput(`Submit error: ${e instanceof Error ? e.message : 'Failed'}`);
      setSubmissionStatus(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = useCallback(async (skipConfirm?: boolean) => {
    if (!attemptId) return;
    if (!skipConfirm && !window.confirm('Submit the entire test? You cannot change your answers after.')) return;
    try {
      await api(`/attempts/${attemptId}/finish`, { method: 'POST' });
      navigate(`/result/${attemptId}`, {
        state:
          fromCourseId || fromTopicId
            ? { fromCourse: fromCourseId, fromTopic: fromTopicId }
            : undefined,
      });
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : 'Finish failed'}`);
    }
  }, [attemptId, navigate, fromCourseId, fromTopicId]);

  if (!attempt || !current) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading compiler...</div>;
  }

  if (attempt.status !== 'in_progress') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Test Already Submitted</h1>
        <button
          onClick={() =>
            navigate(`/result/${attemptId}`, {
              state:
                fromCourseId || fromTopicId
                  ? { fromCourse: fromCourseId, fromTopic: fromTopicId }
                  : undefined,
            })
          }
          style={primaryBtnStyle}
        >
          View Results
        </button>
      </div>
    );
  }

  const statusColor = submissionStatus === 'passed' ? '#22c55e'
    : submissionStatus === 'failed' ? '#ef4444'
    : submissionStatus === 'running' ? '#f59e0b'
    : 'var(--color-text-muted)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() =>
              navigate(`/attempt/${attemptId}`, {
                state:
                  fromCourseId || fromTopicId
                    ? { fromCourse: fromCourseId, fromTopic: fromTopicId }
                    : undefined,
              })
            }
            style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.82rem' }}
          >
            Back to Test
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{attempt.test.title}</span>
          {submissionStatus && (
            <span style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, fontWeight: 600 }}>
              {submissionStatus.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CountdownTimer startedAt={attempt.startedAt} durationMinutes={attempt.test.config.durationMinutes} onExpire={() => handleFinish(true)} />
          <button onClick={() => handleFinish(false)} style={{ ...primaryBtnStyle, background: '#22c55e', fontSize: '0.82rem', padding: '0.35rem 0.8rem' }}>Submit Test</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Question navigation sidebar */}
        {codingQuestions.length > 1 && (
          <div style={{ width: '48px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', padding: '0.5rem 0', overflow: 'auto' }}>
            {codingQuestions.map((tq, i) => {
              const sub = attempt.submissions.find((s) => s.questionId === tq.question.id);
              const sc = sub?.status === 'passed' ? '#22c55e' : sub?.status === 'failed' ? '#ef4444' : 'var(--color-text-muted)';
              return (
                <button key={tq.question.id} onClick={() => setCurrentIdx(i)} style={{
                  display: 'block', width: '36px', height: '36px', margin: '0 auto 0.3rem', borderRadius: '6px',
                  background: currentIdx === i ? 'var(--color-primary)' : 'transparent',
                  color: currentIdx === i ? 'white' : 'var(--color-text)',
                  border: `2px solid ${currentIdx === i ? 'var(--color-primary)' : sc}`,
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                }}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}

        {/* Problem panel */}
        {!problemCollapsed && (
          <div style={{ width: '40%', minWidth: 280, maxWidth: 600, borderRight: '1px solid var(--color-border)', overflow: 'auto', padding: '1rem', position: 'relative' }}>
            <button onClick={() => setProblemCollapsed(true)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem' }} title="Collapse problem panel">
              &laquo;
            </button>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>{content?.title}</h2>
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {content?.description}
            </div>
            {content?.constraints && content.constraints.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem' }}>Constraints</h4>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {content.constraints.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {content?.examples && content.examples.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.88rem' }}>Examples</h4>
                {content.examples.map((ex, i) => (
                  <pre key={i} style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: '4px', overflow: 'auto', fontSize: '0.83rem', marginBottom: '0.5rem' }}>
                    Input: {ex.input}{'\n'}Output: {ex.output}
                  </pre>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor + output */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Editor toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
            {problemCollapsed && (
              <button onClick={() => setProblemCollapsed(false)} style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }} title="Show problem">
                &raquo; Problem
              </button>
            )}
            {attempt.test.config?.codingLanguage ? (
              <span style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                {CODING_LANGUAGE_LABELS[attempt.test.config.codingLanguage as CodingLanguageId] ?? attempt.test.config.codingLanguage}
              </span>
            ) : (
              <select
                value={language}
                onChange={(e) => {
                  const newLang = e.target.value;
                  setLanguage(newLang);
                  const templates = Object.values(DEFAULT_CODE_TEMPLATES);
                  if (!code || templates.includes(code)) {
                    setCode(defaultCodeForLang(newLang));
                  }
                }}
                style={{ padding: '0.3rem 0.6rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)', fontSize: '0.82rem' }}
              >
                {CODING_LANGUAGE_IDS.map((id) => (
                  <option key={id} value={id}>{CODING_LANGUAGE_LABELS[id]}</option>
                ))}
              </select>
            )}
            <button onClick={handleRun} disabled={running} style={{
              padding: '0.3rem 0.75rem', background: running ? '#f59e0b' : '#22c55e', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1,
            }}>
              {running ? 'Running...' : 'Run'}
            </button>
            <button onClick={handleSubmit} disabled={submitting} style={{
              padding: '0.3rem 0.75rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.82rem', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
            }}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>

          {/* Code editor */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language={monacoLanguageForCodingId(language)}
              value={code}
              onChange={(v) => setCode(v ?? '')}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
            />
          </div>

          {/* Output / results panel */}
          {(output || runResults) && (
            <div style={{ maxHeight: '35%', minHeight: 60, overflow: 'auto', borderTop: '1px solid var(--color-border)', padding: '0.6rem 0.75rem', background: 'var(--color-surface)', fontSize: '0.83rem' }}>
              {output && <div style={{ color: 'var(--color-text-muted)', marginBottom: runResults ? '0.4rem' : 0 }}>{output}</div>}
              {runResults && runResults.map((r, i) => (
                <div key={r.testCaseId} style={{
                  padding: '0.4rem 0.6rem', marginBottom: '0.3rem', borderRadius: '4px',
                  background: r.passed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${r.passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  <div style={{ fontWeight: 600, color: r.passed ? '#22c55e' : '#ef4444', fontSize: '0.8rem' }}>
                    Sample {i + 1}: {r.passed ? 'PASS' : 'FAIL'}
                    {r.timedOut && ' (TLE)'}
                    {r.executionTimeMs > 0 && <span style={{ fontWeight: 400, marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>{r.executionTimeMs}ms</span>}
                  </div>
                  {!r.passed && (
                    <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      <div>Input: <code>{r.input}</code></div>
                      <div>Expected: <code>{r.expectedOutput}</code></div>
                      <div>Got: <code>{r.actualOutput || '(empty)'}</code></div>
                      {r.stderr && <div style={{ color: '#ef4444' }}>Error: {r.stderr}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {restrictBrowser && (
        <BrowserRestrictionOverlay
          show={restriction.showWarning}
          message={restriction.warningMessage}
          violationCount={restriction.violationCount}
          onDismiss={restriction.dismissWarning}
        />
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1.2rem',
  background: 'var(--color-primary)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  cursor: 'pointer',
};
