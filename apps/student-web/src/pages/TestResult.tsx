import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface ResultSubmission {
  id: string;
  questionId: string;
  code?: string;
  language?: string;
  selectedOptionId?: string;
  status: string;
  score?: number;
  question: {
    id: string;
    type: string;
    content: {
      title: string;
      description: string;
      options?: { id: string; text: string; isCorrect: boolean }[];
      explanation?: string;
    };
  };
}

interface AttemptResult {
  id: string;
  status: string;
  score?: number;
  maxScore?: number;
  startedAt: string;
  submittedAt?: string;
  resultsAvailable: boolean;
  message?: string;
  result?: 'pass' | 'fail';
  passPercentage?: number;
  percentage?: number;
  test?: { id: string; title: string; type: string; config: Record<string, unknown> };
  submissions?: ResultSubmission[];
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  padding: '1.25rem',
  marginBottom: '0.75rem',
};

export default function TestResult() {
  const { attemptId } = useParams();
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;
    api<AttemptResult>(`/attempts/${attemptId}/result`)
      .then(setResult)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading results...</div>;
  if (!result) return <div style={{ padding: '2rem', color: '#ef4444' }}>Failed to load results.</div>;

  if (!result.resultsAvailable) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>Test Submitted</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: 400, margin: '0 auto 1.5rem' }}>
          {result.message || 'Results will be shared by your instructor once they are ready.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
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
          <Link
            to="/tests"
            style={{
              padding: '0.6rem 1.5rem',
              background: 'var(--color-primary)',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Back to Tests
          </Link>
        </div>
      </div>
    );
  }

  const scorePercent = result.maxScore ? Math.round(((result.score ?? 0) / result.maxScore) * 100) : 0;
  const passPercentage = result.passPercentage ?? 40;
  const resultStatus = result.result ?? (scorePercent >= passPercentage ? 'pass' : 'fail');

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Link to="/tests" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        &larr; Back to Tests
      </Link>

      <h1 style={{ margin: '0.75rem 0 0.25rem', fontSize: '1.5rem' }}>{result.test?.title}</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Submitted {result.submittedAt ? new Date(result.submittedAt).toLocaleString() : '—'}
      </p>

      {/* Score summary */}
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `4px solid ${resultStatus === 'pass' ? '#22c55e' : '#ef4444'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{scorePercent}%</span>
        </div>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            {result.score ?? 0} / {result.maxScore ?? 0}
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {result.submissions?.filter((s) => s.status === 'passed').length ?? 0} of{' '}
            {result.submissions?.length ?? 0} questions correct
          </div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            Result:{' '}
            <span style={{ fontWeight: 700, color: resultStatus === 'pass' ? '#22c55e' : '#ef4444' }}>
              {resultStatus.toUpperCase()}
            </span>{' '}
            (Pass mark: {passPercentage}%)
          </div>
        </div>
      </div>

      {/* Per-question breakdown */}
      <h2 style={{ fontSize: '1.1rem', margin: '1.5rem 0 0.75rem' }}>Question Breakdown</h2>
      {result.submissions?.map((sub, i) => (
        <div key={sub.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 500 }}>Q{i + 1}: {sub.question.content.title}</span>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                background: sub.status === 'passed' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: sub.status === 'passed' ? '#22c55e' : '#ef4444',
              }}
            >
              {sub.status === 'passed' ? 'Correct' : sub.status === 'failed' ? 'Incorrect' : sub.status}
            </span>
          </div>

          {sub.question.type === 'mcq' && sub.question.content.options && (
            <div style={{ marginTop: '0.5rem' }}>
              {sub.question.content.options.map((opt) => {
                const isSelected = sub.selectedOptionId === opt.id;
                const isCorrect = opt.isCorrect;
                let bg = 'transparent';
                let border = 'var(--color-border)';
                if (isCorrect) { bg = 'rgba(34,197,94,0.08)'; border = '#22c55e'; }
                if (isSelected && !isCorrect) { bg = 'rgba(239,68,68,0.08)'; border = '#ef4444'; }
                return (
                  <div
                    key={opt.id}
                    style={{
                      padding: '0.5rem 0.75rem',
                      marginBottom: '0.35rem',
                      borderRadius: '6px',
                      border: `1px solid ${border}`,
                      background: bg,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {isSelected && <span style={{ fontWeight: 600 }}>{isCorrect ? '✓' : '✕'}</span>}
                    {!isSelected && isCorrect && <span style={{ fontWeight: 600, color: '#22c55e' }}>✓</span>}
                    {opt.text}
                  </div>
                );
              })}
              {sub.question.content.explanation && (
                <div style={{ marginTop: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {sub.question.content.explanation}
                </div>
              )}
            </div>
          )}

          {sub.question.type === 'coding' && sub.code && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                Language: {sub.language}
              </div>
              <pre
                style={{
                  background: 'var(--color-bg)',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  maxHeight: '200px',
                }}
              >
                {sub.code}
              </pre>
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'center' }}>
        <Link
          to={`/attempt/${attemptId}?review=1`}
          style={{
            padding: '0.6rem 1.25rem',
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
