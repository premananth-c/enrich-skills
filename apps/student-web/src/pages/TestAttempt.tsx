import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../lib/api';

interface Question {
  id: string;
  type: string;
  content: { title: string; description: string; examples?: { input: string; output: string }[] };
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
  test: { title: string; config: { durationMinutes: number } };
  status: string;
  submissions: Submission[];
  testQuestions: { question: Question; order: number }[];
}

const DEFAULT_CODE: Record<string, string> = {
  python: '# Write your solution here\ndef solve():\n    pass\n',
  javascript: '// Write your solution here\nfunction solve() {\n    //\n}\n',
  java: '// Write your solution here\npublic class Solution {\n    public static void main(String[] args) {\n        //\n    }\n}\n',
  cpp: '// Write your solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    //\n    return 0;\n}\n',
};

export default function TestAttempt() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    api<AttemptData>(`/attempts/${attemptId}`).then((data) => {
      setAttempt(data);
      const sub = data.submissions[0];
      if (sub?.code) setCode(sub.code);
      else setCode(DEFAULT_CODE[sub?.language || 'python'] || DEFAULT_CODE.python);
      if (sub?.language) setLanguage(sub.language);
    });
  }, [attemptId]);

  if (!attempt) return <div>Loading...</div>;
  if (attempt.status !== 'in_progress') {
    return (
      <div>
        <h1>Attempt submitted</h1>
        <p>Score: {attempt.submissions.reduce((s, x) => s + (x.score ?? 0), 0)}</p>
      </div>
    );
  }

  const sorted = [...attempt.testQuestions].sort((a, b) => a.order - b.order);
  const current = sorted[currentIdx];
  const submission = attempt.submissions.find((s) => s.questionId === current?.question.id);

  const handleRun = () => {
    setOutput('Run is not yet implemented. Submit to evaluate.');
  };

  const handleSubmit = async () => {
    if (!current || current.question.type !== 'coding') return;
    setSubmitting(true);
    try {
      await api(`/attempts/${attemptId}/submit-code`, {
        method: 'POST',
        body: JSON.stringify({ questionId: current.question.id, code, language }),
      });
      setOutput('Submitted! Code will be evaluated.');
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : 'Submit failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await api(`/attempts/${attemptId}/finish`, { method: 'POST' });
      window.location.reload();
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : 'Finish failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const content = current?.question.content as { title: string; description: string; examples?: { input: string; output: string }[] };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{attempt.test.title}</h1>
        <button
          onClick={handleFinish}
          disabled={submitting}
          style={{
            padding: '0.5rem 1rem',
            background: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 500,
          }}
        >
          Submit Test
        </button>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        <div
          style={{
            flex: '0 0 320px',
            overflow: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          {sorted.map((tq, i) => (
            <button
              key={tq.question.id}
              onClick={() => setCurrentIdx(i)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                background: currentIdx === i ? 'var(--color-primary)' : 'transparent',
                color: currentIdx === i ? 'white' : 'inherit',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              Q{i + 1}: {(tq.question.content as { title: string }).title}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <h2 style={{ margin: '0 0 0.5rem' }}>{content?.title}</h2>
            <div style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-muted)' }}>{content?.description}</div>
            {content?.examples?.length ? (
              <div style={{ marginTop: '1rem' }}>
                <h4>Examples</h4>
                {content.examples.map((ex, i) => (
                  <pre key={i} style={{ background: 'var(--color-bg)', padding: '0.5rem', borderRadius: '4px', overflow: 'auto' }}>
                    Input: {ex.input}
                    Output: {ex.output}
                  </pre>
                ))}
              </div>
            ) : null}
          </div>
          {current?.question.type === 'coding' && (
            <>
              <div style={{ flex: 1, minHeight: 200 }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                  <button
                    onClick={handleRun}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text)',
                    }}
                  >
                    Run
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden', height: '280px' }}>
                  <Editor
                    height="280px"
                    language={language}
                    value={code}
                    onChange={(v) => setCode(v ?? '')}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 14 }}
                  />
                </div>
              </div>
              {output && (
                <pre
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    margin: 0,
                    overflow: 'auto',
                    maxHeight: '120px',
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
