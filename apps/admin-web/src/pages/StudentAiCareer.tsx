import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface CareerTestInsight {
  testTitle: string;
  languages: string[];
  scoreSummary: string;
  highlights: string;
}

interface CareerReport {
  overallSummary: string;
  languagesAndDomains: string[];
  strengths: string[];
  weaknesses: string[];
  improvementAreas: string[];
  additionalLearning: string[];
  jobMarketOutlook: string;
  testsAnalyzed: number;
  testInsights: CareerTestInsight[];
  recommendations: string[];
}

interface CareerReviewData {
  student: { id: string; name: string; email: string | null };
  codingAttempts: number;
  careerReview: {
    status: string | null;
    report: CareerReport | null;
    error: string | null;
    generatedAt: string | null;
    testsAnalyzed: number | null;
  };
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '1.25rem',
  marginBottom: '1rem',
};

export default function StudentAiCareer() {
  const { studentId } = useParams();
  const { canEdit } = useAuth();
  const [data, setData] = useState<CareerReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!studentId) {
        setError('Invalid student');
        setLoading(false);
        return;
      }
      if (!opts?.silent) {
        setLoading(true);
        setError('');
      }
      try {
        const res = await api<CareerReviewData>(`/users/${studentId}/ai-career-review`, {
          silent: true,
        });
        setData(res);
        setError('');
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof Error ? e.message : 'Failed to load career report');
          setData(null);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [studentId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const status = data?.careerReview.status;
    if (status !== 'queued' && status !== 'generating') return;
    const t = setInterval(() => void load({ silent: true }), 5000);
    const stop = setTimeout(() => clearInterval(t), 180_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [data?.careerReview.status, load]);

  const handleGenerate = async () => {
    if (!studentId) return;
    setRegenerating(true);
    try {
      await api(`/users/${studentId}/ai-career-review/regenerate`, { method: 'POST' });
      setData((prev) =>
        prev
          ? {
              ...prev,
              careerReview: {
                ...prev.careerReview,
                status: 'queued',
                report: null,
                error: null,
              },
            }
          : prev
      );
      await load({ silent: true });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to queue report');
    } finally {
      setRegenerating(false);
    }
  };

  const status = data?.careerReview.status ?? null;
  const showRegenerateLabel =
    status === 'ready' ||
    status === 'failed' ||
    status === 'queued' ||
    status === 'generating';

  if (loading) {
    return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading…</div>;
  }
  if (error || !data) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#ef4444' }}>{error || 'Not found'}</p>
        <Link to="/students" style={{ color: 'var(--color-text-muted)' }}>
          &larr; Back to students
        </Link>
      </div>
    );
  }

  const { student, codingAttempts, careerReview } = data;
  const report = careerReview.report;
  const canGenerate = canEdit('students');

  return (
    <div>
      <Link to="/students" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        &larr; Back to students
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '0.75rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem' }}>{student.name}</h1>
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{student.email ?? '—'}</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            {codingAttempts} completed coding test{codingAttempts === 1 ? '' : 's'} with submissions
          </p>
        </div>
        {canGenerate && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={regenerating || codingAttempts === 0}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              cursor: regenerating || codingAttempts === 0 ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {regenerating
              ? 'Queuing…'
              : showRegenerateLabel
                ? 'Regenerate career comparison report'
                : 'Generate career comparison report'}
          </button>
        )}
      </div>

      <div style={{ ...cardStyle, marginTop: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>
          Cross-test AI career comparison
        </h2>

        {careerReview.status && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Status: <strong>{careerReview.status}</strong>
            {careerReview.generatedAt &&
              careerReview.status === 'ready' &&
              ` · Generated ${new Date(careerReview.generatedAt).toLocaleString()}`}
          </p>
        )}

        {!careerReview.status && (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            No report yet. Generate one to compare this student across all coding tests they have taken.
          </p>
        )}

        {(careerReview.status === 'queued' || careerReview.status === 'generating') && (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Generating career comparison report… (auto-refreshes every few seconds). If this stays
            longer than 2 minutes, click Regenerate.
          </p>
        )}

        {careerReview.status === 'failed' && (
          <p style={{ margin: 0, color: '#ef4444' }}>
            Report failed{careerReview.error ? `: ${careerReview.error}` : '.'} Click Regenerate to
            retry.
          </p>
        )}

        {report && (
          <>
            <p style={{ margin: '0 0 1rem', lineHeight: 1.5 }}>{report.overallSummary}</p>
            {report.languagesAndDomains.length > 0 && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
                <strong>Languages & domains:</strong> {report.languagesAndDomains.join(' · ')}
              </p>
            )}
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem' }}>
              <strong>Job market outlook:</strong> {report.jobMarketOutlook}
            </p>

            {report.testInsights.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Per-test highlights</h3>
                {report.testInsights.map((t) => (
                  <div
                    key={t.testTitle}
                    style={{
                      marginBottom: '0.5rem',
                      padding: '0.75rem',
                      background: 'var(--color-bg)',
                      borderRadius: 6,
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{t.testTitle}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      {t.scoreSummary}
                      {t.languages.length ? ` · ${t.languages.join(', ')}` : ''}
                    </div>
                    <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>{t.highlights}</div>
                  </div>
                ))}
              </div>
            )}

            <ListSection title="Strengths" items={report.strengths} color="#22c55e" />
            <ListSection title="Weaknesses" items={report.weaknesses} color="#f59e0b" />
            <ListSection title="Improvement areas" items={report.improvementAreas} />
            <ListSection title="Additional learning (job readiness)" items={report.additionalLearning} />
            <ListSection title="Recommendations" items={report.recommendations} />
          </>
        )}
      </div>
    </div>
  );
}

function ListSection({
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
      <div style={{ fontWeight: 600, fontSize: '0.9rem', color, marginBottom: '0.25rem' }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
