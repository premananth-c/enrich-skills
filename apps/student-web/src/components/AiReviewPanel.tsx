import { useEffect, useState, useCallback } from 'react';
import { formatDuration } from '@enrich-skills/shared';
import { api } from '../lib/api';

export interface AiReviewReport {
  language: string;
  overallSummary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  scores: { correctness: number; readability: number; efficiency: number; style: number };
}

export interface AiReviewState {
  questionId: string;
  status: string | null;
  report: AiReviewReport | null;
  error: string | null;
  model: string | null;
  language: string | null;
  generatedAt: string | null;
  timeSpentSeconds?: number | null;
}

interface AiReviewPanelProps {
  attemptId: string;
  questionId: string;
  initial?: Pick<
    AiReviewState,
    'status' | 'report' | 'error' | 'model' | 'language' | 'generatedAt' | 'timeSpentSeconds'
  >;
  timeSpentSeconds?: number | null;
  pollWhenPending?: boolean;
}

const panelStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '1rem',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
};

const scoreLabels: { key: keyof AiReviewReport['scores']; label: string }[] = [
  { key: 'correctness', label: 'Correctness' },
  { key: 'readability', label: 'Readability' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'style', label: 'Style' },
];

export default function AiReviewPanel({
  attemptId,
  questionId,
  initial,
  timeSpentSeconds: timeSpentProp,
  pollWhenPending = true,
}: AiReviewPanelProps) {
  const [state, setState] = useState<AiReviewState | null>(
    initial
      ? {
          questionId,
          status: initial.status ?? null,
          report: initial.report ?? null,
          error: initial.error ?? null,
          model: initial.model ?? null,
          language: initial.language ?? null,
          generatedAt: initial.generatedAt ?? null,
        }
      : null
  );

  const fetchReview = useCallback(async () => {
    try {
      const res = await api<{ reviews: AiReviewState[] }>(`/attempts/${attemptId}/ai-review`);
      const item = res.reviews.find((r) => r.questionId === questionId);
      if (item) setState(item);
    } catch {
      // ignore poll errors
    }
  }, [attemptId, questionId]);

  useEffect(() => {
    if (!pollWhenPending) return;
    const status = state?.status;
    if (status !== 'queued' && status !== 'generating') return;

    const interval = setInterval(fetchReview, 4000);
    const timeout = setTimeout(() => clearInterval(interval), 60_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [state?.status, pollWhenPending, fetchReview]);

  useEffect(() => {
    if (!initial && !state) {
      void fetchReview();
    }
  }, [initial, state, fetchReview]);

  const status = state?.status;
  const report = state?.report;

  if (!status || status === 'skipped') {
    return (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>AI Code Review</div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          AI review is not available for this submission.
        </p>
      </div>
    );
  }

  if (status === 'queued' || status === 'generating') {
    return (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>AI Code Review</div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Analyzing your code…
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>AI Code Review</div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          AI review could not be generated. Please check back later or contact your instructor.
        </p>
      </div>
    );
  }

  if (!report) return null;

  const timeSpent = timeSpentProp ?? state?.timeSpentSeconds ?? null;

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>AI Code Review</div>
      {timeSpent != null && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Time to submit this question: <strong>{formatDuration(timeSpent)}</strong>
        </p>
      )}
      <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', lineHeight: 1.45 }}>{report.overallSummary}</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {scoreLabels.map(({ key, label }) => (
          <div key={key} style={{ fontSize: '0.8rem' }}>
            <div style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            <div style={{ fontWeight: 600 }}>{report.scores[key]} / 5</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {report.strengths.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#22c55e', marginBottom: '0.25rem' }}>
              Strengths
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              {report.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {report.weaknesses.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f59e0b', marginBottom: '0.25rem' }}>
              Areas to improve
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              {report.weaknesses.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {report.recommendations.length > 0 && (
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              Recommendations
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              {report.recommendations.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
