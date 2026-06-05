import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

export interface AttemptTopicInsight {
  topic: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  trend?: string;
}

export interface AttemptTimeAnalysis {
  totalTimeSeconds: number;
  summary: string;
  observations: string[];
}

export interface AttemptOverallReviewReport {
  overallSummary: string;
  performanceTrend: string;
  topicInsights: AttemptTopicInsight[];
  overallStrengths: string[];
  overallWeaknesses: string[];
  improvementAreas?: string[];
  additionalLearning?: string[];
  jobReadinessNote?: string;
  timeAnalysis?: AttemptTimeAnalysis;
  recommendations: string[];
}

export interface AttemptOverallReviewState {
  status: string | null;
  report: AttemptOverallReviewReport | null;
  error: string | null;
  model: string | null;
  generatedAt: string | null;
}

interface AttemptOverallReviewPanelProps {
  attemptId: string;
  initial?: AttemptOverallReviewState;
  totalTestDuration?: string | null;
}

const panelStyle: React.CSSProperties = {
  marginTop: '1.25rem',
  marginBottom: '1.25rem',
  padding: '1.25rem',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
};

export default function AttemptOverallReviewPanel({
  attemptId,
  initial,
  totalTestDuration,
}: AttemptOverallReviewPanelProps) {
  const [state, setState] = useState<AttemptOverallReviewState | null>(initial ?? null);

  const fetchOverall = useCallback(async () => {
    try {
      const res = await api<{ overall: AttemptOverallReviewState }>(
        `/attempts/${attemptId}/ai-review`
      );
      if (res.overall) setState(res.overall);
    } catch {
      // ignore poll errors
    }
  }, [attemptId]);

  useEffect(() => {
    if (initial) setState(initial);
  }, [initial]);

  // Backfill: attempts finished before overall review shipped have null status.
  useEffect(() => {
    if (!initial?.status) void fetchOverall();
  }, [attemptId, initial?.status, fetchOverall]);

  useEffect(() => {
    const status = state?.status;
    if (status !== 'queued' && status !== 'generating') return;
    const t = setInterval(() => void fetchOverall(), 4000);
    const stop = setTimeout(() => clearInterval(t), 120_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [state?.status, fetchOverall]);

  const status = state?.status;
  const report = state?.report;
  const error = state?.error;

  if (status === 'skipped') return null;

  if (!status) {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Overall AI Test Review</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Overall test review has not been generated for this attempt yet. Your instructor can
          trigger it from the admin attempt view, or it will be created automatically on newly
          submitted tests.
        </p>
      </div>
    );
  }

  if (status === 'queued' || status === 'generating') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Overall AI Test Review</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Generating your overall performance report…
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={panelStyle}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Overall AI Test Review</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Overall review could not be generated{error ? `: ${error}` : '.'}
        </p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div style={panelStyle}>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>Overall AI Test Review</h2>
      {totalTestDuration && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Total test time: <strong>{totalTestDuration}</strong>
        </p>
      )}
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
                borderRadius: '8px',
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

      {report.timeAnalysis && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          <strong>Time management:</strong> {report.timeAnalysis.summary}
          {report.timeAnalysis.observations.length > 0 && (
            <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem' }}>
              {report.timeAnalysis.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {report.jobReadinessNote && (
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
          <strong>Job readiness:</strong> {report.jobReadinessNote}
        </p>
      )}
      <InsightList title="Overall strengths" items={report.overallStrengths} color="#22c55e" />
      <InsightList title="Areas to improve" items={report.overallWeaknesses} color="#f59e0b" />
      <InsightList title="Improvement areas" items={report.improvementAreas ?? []} />
      <InsightList title="Additional learning" items={report.additionalLearning ?? []} />
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
