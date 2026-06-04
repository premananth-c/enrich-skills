import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface AttemptTopicInsight {
  topic: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  trend?: string;
}

export interface AttemptOverallReviewReport {
  overallSummary: string;
  performanceTrend: string;
  topicInsights: AttemptTopicInsight[];
  overallStrengths: string[];
  overallWeaknesses: string[];
  recommendations: string[];
}

interface AttemptOverallReviewPanelProps {
  attemptId: string;
  status: string | null;
  report: AttemptOverallReviewReport | null;
  error?: string | null;
  canRegenerate?: boolean;
  onRefreshed?: () => void;
}

const panelStyle: React.CSSProperties = {
  marginBottom: '1.5rem',
  padding: '1.25rem',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
};

export default function AttemptOverallReviewPanel({
  attemptId,
  status,
  report,
  error,
  canRegenerate,
  onRefreshed,
}: AttemptOverallReviewPanelProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await api(`/attempts/${attemptId}/ai-overall-review/regenerate`, { method: 'POST' });
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
    const stop = setTimeout(() => clearInterval(t), 120_000);
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
      localStatus === 'generating' ||
      localStatus === 'ready');

  const regenerateButton = showRegenerate ? (
    <button
      type="button"
      onClick={handleRegenerate}
      disabled={regenerating}
      style={{
        padding: '0.35rem 0.75rem',
        fontSize: '0.8rem',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        cursor: regenerating ? 'wait' : 'pointer',
        flexShrink: 0,
      }}
    >
      {regenerating
        ? 'Queuing…'
        : localStatus === 'generating' || localStatus === 'queued'
          ? 'Retry overall review'
          : 'Regenerate overall test review'}
    </button>
  ) : null;

  if (!localStatus || localStatus === 'skipped') return null;

  if (localStatus === 'queued' || localStatus === 'generating') {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Overall AI Test Review</h2>
          {regenerateButton}
        </div>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Generating overall performance report…
        </p>
      </div>
    );
  }

  if (localStatus === 'failed') {
    return (
      <div style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Overall AI Test Review</h2>
          {regenerateButton}
        </div>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Overall review failed{error ? `: ${error}` : '.'}
        </p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Overall AI Test Review</h2>
        {regenerateButton}
      </div>
      <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', lineHeight: 1.5 }}>{report.overallSummary}</p>
      {report.performanceTrend && (
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          <strong>Trend:</strong> {report.performanceTrend}
        </p>
      )}

      {report.topicInsights.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>By topic</h3>
          {report.topicInsights.map((topic) => (
            <div
              key={topic.topic}
              style={{
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: 'var(--color-bg)',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {topic.topic}
                {topic.trend ? (
                  <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {' '}
                    · {topic.trend}
                  </span>
                ) : null}
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{topic.summary}</p>
              {topic.strengths.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#22c55e', marginBottom: '0.25rem' }}>
                  Strengths: {topic.strengths.join(' · ')}
                </div>
              )}
              {topic.weaknesses.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
                  Focus areas: {topic.weaknesses.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <InsightList title="Overall strengths" items={report.overallStrengths} color="#22c55e" />
      <InsightList title="Areas to improve" items={report.overallWeaknesses} color="#f59e0b" />
      <InsightList title="Recommendations" items={report.recommendations} />
    </div>
  );
}

function InsightList({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color, marginBottom: '0.25rem' }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
