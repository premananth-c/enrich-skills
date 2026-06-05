import { useEffect, useState } from 'react';
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

interface AiReviewPanelProps {
  attemptId: string;
  questionId: string;
  status: string | null;
  report: AiReviewReport | null;
  timeSpentSeconds?: number | null;
  error?: string | null;
  canRegenerate?: boolean;
  /** Silent refresh of attempt detail (no full-page loading). */
  onRefreshed?: () => void;
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
  status,
  report,
  timeSpentSeconds,
  error,
  canRegenerate,
  onRefreshed,
}: AiReviewPanelProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await api(`/attempts/${attemptId}/ai-review/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: [questionId] }),
      });
      setLocalStatus('queued');
      onRefreshed?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to queue regeneration');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    if (localStatus !== 'queued' && localStatus !== 'generating') return;
    const t = setInterval(() => onRefreshed?.(), 4000);
    const stop = setTimeout(() => clearInterval(t), 60_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [localStatus, onRefreshed]);

  const showRegenerate =
    canRegenerate &&
    (localStatus === 'failed' ||
      localStatus == null ||
      localStatus === 'queued' ||
      localStatus === 'generating');

  const regenerateButton = showRegenerate ? (
    <button
      type="button"
      onClick={handleRegenerate}
      disabled={regenerating}
      style={{
        padding: '0.3rem 0.6rem',
        fontSize: '0.8rem',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        cursor: regenerating ? 'wait' : 'pointer',
        flexShrink: 0,
      }}
    >
      {regenerating ? 'Queuing…' : localStatus === 'generating' || localStatus === 'queued' ? 'Retry' : 'Regenerate'}
    </button>
  ) : null;

  if (!localStatus || localStatus === 'skipped') {
    return (
      <div style={panelStyle}>
        <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>AI Code Review</div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          No AI review for this submission.
        </p>
      </div>
    );
  }

  if (localStatus === 'queued' || localStatus === 'generating') {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>AI Code Review</div>
          {regenerateButton}
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Generating review… (updates every few seconds)
        </p>
      </div>
    );
  }

  if (localStatus === 'failed') {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>AI Code Review</div>
          {regenerateButton}
        </div>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Review failed{error ? `: ${error}` : '.'}
        </p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 600 }}>AI Code Review</div>
        {regenerateButton}
      </div>
      {timeSpentSeconds != null && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Time to submit: <strong>{formatDuration(timeSpentSeconds)}</strong>
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
