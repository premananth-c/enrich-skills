import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatStatusLabel } from '../lib/status';
import AiReviewPanel, { type AiReviewReport } from '../components/AiReviewPanel';

interface SubmissionDetail {
  id: string;
  questionId: string;
  code: string | null;
  language: string | null;
  status: string;
  score: number | null;
  output: string | null;
  errorMessage: string | null;
  aiReviewStatus: string | null;
  aiReview: AiReviewReport | null;
  aiReviewError: string | null;
  question: {
    id: string;
    type: string;
    content: { title?: string; description?: string };
    difficulty: string;
  };
  testCaseResults: Array<{
    passed: boolean;
    testCase: { isPublic: boolean; input?: string; expectedOutput?: string };
  }>;
}

interface AttemptDetailData {
  test: { id: string; title: string; type: string; config: { aiFeedbackEnabled?: boolean } };
  attempt: {
    id: string;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    maxScore: number | null;
    status: string;
    user: { id: string; name: string; email: string | null };
    submissions: SubmissionDetail[];
  };
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '1.25rem',
  marginBottom: '0.75rem',
};

export default function AttemptDetail() {
  const { id: testId, attemptId } = useParams();
  const { canEdit } = useAuth();
  const [data, setData] = useState<AttemptDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!testId || !attemptId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api<AttemptDetailData>(
        `/tests/${testId}/attempts/${attemptId}/detail`
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attempt');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [testId, attemptId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading attempt…</div>;
  }
  if (error || !data) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#ef4444' }}>{error || 'Attempt not found'}</p>
        {testId && (
          <Link to={`/tests/${testId}`} style={{ color: 'var(--color-text-muted)' }}>
            &larr; Back to test
          </Link>
        )}
      </div>
    );
  }

  const { test, attempt } = data;
  const aiEnabled = test.config?.aiFeedbackEnabled === true;
  const canRegenerate = canEdit('tests') && aiEnabled;

  return (
    <div>
      <Link to={`/tests/${testId}`} style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        &larr; Back to {test.title}
      </Link>

      <h1 style={{ margin: '0.75rem 0 0.25rem' }}>{attempt.user.name}</h1>
      <p style={{ color: 'var(--color-text-muted)', margin: '0 0 0.5rem' }}>
        {attempt.user.email ?? '—'}
      </p>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Started {new Date(attempt.startedAt).toLocaleString()}
        {attempt.submittedAt && ` · Submitted ${new Date(attempt.submittedAt).toLocaleString()}`}
        {' · '}
        Status: {formatStatusLabel(attempt.status)}
        {attempt.score != null && attempt.maxScore != null && (
          <> · Score: {attempt.score} / {attempt.maxScore}</>
        )}
      </p>

      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Submissions</h2>
      {attempt.submissions.map((sub, i) => (
        <div key={sub.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600 }}>
              Q{i + 1}: {sub.question.content?.title || '(untitled)'}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 4,
                background:
                  sub.status === 'passed' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: sub.status === 'passed' ? '#22c55e' : '#ef4444',
              }}
            >
              {sub.status}
              {sub.score != null ? ` · ${sub.score}` : ''}
            </span>
          </div>

          {sub.question.type === 'coding' && sub.code && (
            <>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
                Language: {sub.language ?? '—'}
              </div>
              <pre
                style={{
                  background: 'var(--color-bg)',
                  padding: '0.75rem',
                  borderRadius: 6,
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  maxHeight: 280,
                  margin: '0 0 0.75rem',
                }}
              >
                {sub.code}
              </pre>
              {sub.testCaseResults.length > 0 && (
                <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Test cases: {sub.testCaseResults.filter((t) => t.passed).length} /{' '}
                  {sub.testCaseResults.length} passed
                </div>
              )}
              {aiEnabled && attemptId && (
                <AiReviewPanel
                  attemptId={attemptId}
                  questionId={sub.questionId}
                  status={sub.aiReviewStatus}
                  report={sub.aiReview}
                  error={sub.aiReviewError}
                  canRegenerate={
                    canRegenerate &&
                    (sub.aiReviewStatus === 'failed' || sub.aiReviewStatus == null)
                  }
                  onRegenerated={load}
                />
              )}
            </>
          )}

          {sub.question.type === 'mcq' && (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              MCQ submission (no code review).
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
