import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';
import CountdownTimer from '../components/CountdownTimer';

interface Question {
  id: string;
  type: string;
  content: {
    title: string;
    description: string;
    examples?: { input: string; output: string }[];
    options?: { id: string; text: string; isCorrect?: boolean }[];
    explanation?: string;
  };
  testCases?: { input: string; expectedOutput: string; isPublic: boolean }[];
}

interface Submission {
  id: string;
  questionId: string;
  code?: string;
  language?: string;
  selectedOptionId?: string;
  status: string;
  score?: number;
}

interface AttemptData {
  id: string;
  startedAt: string;
  test: {
    title: string;
    config: { durationMinutes: number; showResultsImmediately: boolean };
    testQuestions: { question: Question; order: number }[];
  };
  status: string;
  submissions: Submission[];
}

const DEFAULT_CODE: Record<string, string> = {
  python: '# Write your solution here\ndef solve():\n    pass\n',
  javascript: '// Write your solution here\nfunction solve() {\n    //\n}\n',
  java: '// Write your solution here\npublic class Solution {\n    public static void main(String[] args) {\n        //\n    }\n}\n',
  cpp: '// Write your solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    //\n    return 0;\n}\n',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--color-text-muted)',
  running: '#f59e0b',
  passed: '#22c55e',
  failed: '#ef4444',
  error: '#ef4444',
};

export default function TestAttempt() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reviewMode = searchParams.get('review') === '1';
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [langMap, setLangMap] = useState<Record<string, string>>({});
  const [output, setOutput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [mcqFeedback, setMcqFeedback] = useState<Record<string, { status: string; correct: boolean } | null>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!attemptId) return;
    const endpoint = reviewMode ? `/attempts/${attemptId}/review` : `/attempts/${attemptId}`;
    api<AttemptData>(endpoint).then((data) => {
      setAttempt(data);
      const codes: Record<string, string> = {};
      const langs: Record<string, string> = {};
      const selections: Record<string, string> = {};
      data.submissions.forEach((sub) => {
        codes[sub.questionId] = sub.code || DEFAULT_CODE[sub.language || 'python'] || DEFAULT_CODE.python;
        langs[sub.questionId] = sub.language || 'python';
        if (sub.selectedOptionId) selections[sub.questionId] = sub.selectedOptionId;
      });
      setCodeMap(codes);
      setLangMap(langs);
      setSelectedOptions(selections);
    });
  }, [attemptId, reviewMode]);

  const handleFinish = useCallback(async () => {
    if (finishing) return;
    if (!attemptId) {
      setOutput('Unable to submit test: attempt id is missing.');
      return;
    }
    if (!window.confirm('Are you sure you want to submit the test? You cannot change your answers after submission.')) return;
    setFinishing(true);
    try {
      await api<{ resultsAvailable: boolean }>(`/attempts/${attemptId}/finish`, { method: 'POST' });
      navigate(`/result/${attemptId}`);
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : 'Finish failed'}`);
    } finally {
      setFinishing(false);
    }
  }, [attemptId, finishing, navigate]);

  if (!attempt) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  if (attempt.status !== 'in_progress' && !reviewMode) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Test Submitted</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>This attempt has already been submitted.</p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => navigate(`/result/${attemptId}`)}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
            }}
          >
            View Results
          </button>
          <Link
            to={`/attempt/${attemptId}?review=1`}
            style={{
              padding: '0.6rem 1.5rem',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'var(--color-text)',
              fontWeight: 500,
            }}
          >
            Review Answers
          </Link>
        </div>
      </div>
    );
  }

  const sorted = [...attempt.test.testQuestions].sort((a, b) => a.order - b.order);
  const current = sorted[currentIdx];
  const submission = attempt.submissions.find((s) => s.questionId === current?.question.id);
  const qId = current?.question.id || '';
  const currentCode = codeMap[qId] || DEFAULT_CODE.python;
  const currentLang = langMap[qId] || 'python';
  const savedCode = submission?.code || DEFAULT_CODE[submission?.language || 'python'] || DEFAULT_CODE.python;
  const savedLang = submission?.language || 'python';

  const handleCodeSubmit = async () => {
    if (!current || current.question.type !== 'coding') return;
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const res = await api<{ status: string }>(`/attempts/${attemptId}/submit-code`, {
        method: 'POST',
        body: JSON.stringify({ questionId: qId, code: currentCode, language: currentLang }),
      });
      setOutput(`Code submitted. Status: ${res.status}`);
      setAttempt((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.questionId === qId ? { ...s, code: currentCode, language: currentLang, status: 'pending' } : s
          ),
        };
      });
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : 'Submit failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMcqSelect = (optionId: string) => {
    if (submission?.selectedOptionId) return;
    setSelectedOptions((prev) => ({ ...prev, [qId]: optionId }));
  };

  const handleMcqSubmit = async () => {
    if (!current) return;
    if (!attemptId) return;
    const optionId = selectedOptions[qId];
    if (!optionId) return;
    setSubmitting(true);
    try {
      const res = await api<{ status: string; correct: boolean }>(`/attempts/${attemptId}/submit-mcq`, {
        method: 'POST',
        body: JSON.stringify({ questionId: qId, selectedOptionId: optionId }),
      });
      setMcqFeedback((prev) => ({ ...prev, [qId]: { status: res.status, correct: res.correct } }));
      setAttempt((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.questionId === qId ? { ...s, selectedOptionId: optionId, status: res.status, score: res.correct ? 1 : 0 } : s
          ),
        };
      });
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : 'Submit failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const content = current?.question.content;
  const isCoding = current?.question.type === 'coding';
  const isMcq = current?.question.type === 'mcq';
  const showImmediate = attempt.test.config.showResultsImmediately;
  const isReview = reviewMode || attempt.status !== 'in_progress';
  const hasAnyResponse = attempt.submissions.some((sub) => {
    if (sub.selectedOptionId) return true;
    if (sub.code && sub.code.trim().length > 0) return true;
    return false;
  });
  const isCodeDirty = currentCode !== savedCode || currentLang !== savedLang;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div
        style={{
          marginBottom: '0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>{attempt.test.title}</h1>
        {isReview ? (
          <div
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              background: 'rgba(99,102,241,0.15)',
              color: 'var(--color-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Review Mode
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CountdownTimer
              startedAt={attempt.startedAt}
              durationMinutes={attempt.test.config.durationMinutes}
              onExpire={handleFinish}
            />
            <button
              onClick={handleFinish}
              disabled={finishing || !hasAnyResponse}
              style={{
                padding: '0.5rem 1rem',
                background: '#22c55e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 500,
                opacity: finishing || !hasAnyResponse ? 0.7 : 1,
                cursor: finishing || !hasAnyResponse ? 'not-allowed' : 'pointer',
              }}
            >
              {finishing ? 'Submitting...' : 'Submit Test'}
            </button>
          </div>
        )}
      </div>
      {output && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            fontSize: '0.88rem',
          }}
        >
          {output}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minHeight: 0 }}>
        {/* Question navigation */}
        <div
          style={{
            flex: '0 0 200px',
            overflow: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '0.75rem',
          }}
        >
          {sorted.map((tq, i) => {
            const sub = attempt.submissions.find((s) => s.questionId === tq.question.id);
            const statusColor = sub ? STATUS_COLORS[sub.status] || 'var(--color-text-muted)' : 'var(--color-text-muted)';
            return (
              <button
                key={tq.question.id}
                onClick={() => { setCurrentIdx(i); setOutput(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  marginBottom: '0.35rem',
                  background: currentIdx === i ? 'var(--color-primary)' : 'transparent',
                  color: currentIdx === i ? 'white' : 'inherit',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColor,
                    flexShrink: 0,
                  }}
                />
                Q{i + 1}
              </button>
            );
          })}
        </div>

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          {/* Question description */}
          <div
            style={{
              flex: isCoding ? '0 0 auto' : 1,
              maxHeight: isCoding ? '35%' : undefined,
              overflow: 'auto',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{content?.title}</h2>
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              {content?.description}
            </div>
            {content?.examples?.length ? (
              <div style={{ marginTop: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Examples</h4>
                {content.examples.map((ex, i) => (
                  <pre
                    key={i}
                    style={{
                      background: 'var(--color-bg)',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      overflow: 'auto',
                      fontSize: '0.85rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Input: {ex.input}{'\n'}Output: {ex.output}
                  </pre>
                ))}
              </div>
            ) : null}

            {/* MCQ options */}
            {isMcq && content?.options && (() => {
              const isSubmitted = isReview || !!submission?.selectedOptionId;
              const feedback = mcqFeedback[qId];
              const localSelection = selectedOptions[qId] || '';
              const correctOption = content.options.find((opt) => opt.isCorrect);

              return (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Options</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {content.options.map((opt) => {
                      const isSelected = localSelection === opt.id;
                      let borderColor = 'var(--color-border)';
                      let bg = 'var(--color-bg)';

                      if (isReview && opt.isCorrect) {
                        borderColor = '#22c55e';
                        bg = 'rgba(34,197,94,0.1)';
                      } else if (isReview && isSelected && !opt.isCorrect) {
                        borderColor = '#ef4444';
                        bg = 'rgba(239,68,68,0.1)';
                      } else if (isSubmitted && isSelected && feedback && showImmediate) {
                        borderColor = feedback.correct ? '#22c55e' : '#ef4444';
                        bg = feedback.correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
                      } else if (isSelected) {
                        borderColor = 'var(--color-primary)';
                        bg = 'rgba(99,102,241,0.1)';
                      }

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleMcqSelect(opt.id)}
                          disabled={isSubmitted || isReview}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            background: bg,
                            border: `2px solid ${borderColor}`,
                            borderRadius: '8px',
                            textAlign: 'left',
                            color: 'var(--color-text)',
                            cursor: isSubmitted ? 'default' : 'pointer',
                            fontSize: '0.9rem',
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              border: `2px solid ${isSelected ? borderColor : 'var(--color-text-muted)'}`,
                              background: isSelected ? borderColor : 'transparent',
                              flexShrink: 0,
                            }}
                          />
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>

                  {!isSubmitted && !isReview && localSelection && (
                    <button
                      onClick={handleMcqSubmit}
                      disabled={submitting || localSelection === submission?.selectedOptionId}
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.6rem 1.5rem',
                        background: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        cursor: submitting || localSelection === submission?.selectedOptionId ? 'not-allowed' : 'pointer',
                        opacity: submitting || localSelection === submission?.selectedOptionId ? 0.7 : 1,
                      }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Answer'}
                    </button>
                  )}

                  {!isReview && isSubmitted && showImmediate && feedback && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        background: feedback.correct ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: feedback.correct ? '#22c55e' : '#ef4444',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      {feedback.correct ? 'Correct!' : 'Incorrect'}
                      {content.explanation && (
                        <div style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                          {content.explanation}
                        </div>
                      )}
                    </div>
                  )}

                  {!isReview && isSubmitted && !showImmediate && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(99,102,241,0.1)',
                        color: 'var(--color-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      Answer submitted
                    </div>
                  )}
                  {isReview && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(99,102,241,0.1)',
                        color: 'var(--color-text)',
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        Correct Answer: {correctOption?.text ?? 'Not available'}
                      </div>
                      {content.explanation && (
                        <div style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
                          {content.explanation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Code editor for coding questions */}
          {isCoding && (
            <>
              <div style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column' }}>
                {!isReview && <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    value={currentLang}
                    onChange={(e) => setLangMap((prev) => ({ ...prev, [qId]: e.target.value }))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button
                    onClick={() => setOutput('Run is not yet implemented. Submit to evaluate.')}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                    }}
                  >
                    Run
                  </button>
                  <button
                    onClick={handleCodeSubmit}
                    disabled={submitting || !isCodeDirty}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      opacity: submitting || !isCodeDirty ? 0.7 : 1,
                      cursor: submitting || !isCodeDirty ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>}
                <div style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <Editor
                    height="100%"
                    language={currentLang === 'cpp' ? 'cpp' : currentLang}
                    value={currentCode}
                    onChange={(v) => setCodeMap((prev) => ({ ...prev, [qId]: v ?? '' }))}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 14, readOnly: isReview }}
                  />
                </div>
              </div>
              {!isReview && output && (
                <pre
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    margin: 0,
                    overflow: 'auto',
                    maxHeight: '100px',
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {output}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
