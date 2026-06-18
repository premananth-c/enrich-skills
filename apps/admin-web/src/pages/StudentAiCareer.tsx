import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { isIndustryCareerReport, type AiCareerReviewLegacy, type AiCareerReviewPayload } from '@enrich-skills/shared';
import { api } from '../lib/api';
import { downloadCareerReportPdf } from '../lib/careerReportPdf';
import { emitToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';
import { adminBtnCancel, adminBtnPrimary } from '../lib/adminButtonStyles';

const careerReportGreenBtn: React.CSSProperties = {
  padding: '0.5rem 1.25rem',
  background: '#16a34a',
  color: '#fff',
  border: '1px solid #15803d',
  borderRadius: 6,
  fontWeight: 500,
  fontSize: '0.9rem',
  cursor: 'pointer',
};

interface CareerReviewData {
  student: { id: string; name: string; email: string | null };
  codingAttempts: number;
  careerReview: {
    status: string | null;
    report: AiCareerReviewPayload | AiCareerReviewLegacy | null;
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

const sectionTitle: React.CSSProperties = {
  fontSize: '1.25rem',
  margin: '0 0 0.75rem',
  fontWeight: 600,
  lineHeight: 1.35,
};

const bodyText: React.CSSProperties = {
  fontSize: '1.05rem',
  lineHeight: 1.6,
};

const smallMuted: React.CSSProperties = {
  fontSize: '0.95rem',
  color: 'var(--color-text-muted)',
};

export default function StudentAiCareer() {
  const { studentId } = useParams();
  const { canView } = useAuth();
  const [data, setData] = useState<CareerReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPdf = async () => {
    const el = reportRef.current;
    if (!el || !data) return;
    setDownloadingPdf(true);
    try {
      const safeName = data.student.name.replace(/[^\w\-]+/g, '_').slice(0, 40);
      await downloadCareerReportPdf(el, `career-report-${safeName}.pdf`);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!studentId) return;
    if (!data?.student.email) {
      emitToast('error', 'Student has no email address on file');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await api<{ message: string }>(`/users/${studentId}/ai-career-review/send-email`, {
        method: 'POST',
      });
      emitToast('success', res.message);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

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
  const canGenerate = canView('students');
  const isV2 = report != null && isIndustryCareerReport(report);

  const reportReady = careerReview.status === 'ready' && report != null;

  return (
    <div style={{ maxWidth: 1040 }}>
      <Link to="/students" style={{ ...smallMuted }}>
        &larr; Back to students
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.75rem' }}>{student.name}</h1>
          <p style={{ margin: 0, ...bodyText, color: 'var(--color-text-muted)' }}>{student.email ?? '—'}</p>
          <p style={{ margin: '0.5rem 0 0', ...smallMuted }}>
            {codingAttempts} completed coding test{codingAttempts === 1 ? '' : 's'} with submissions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          {reportReady && (
            <>
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloadingPdf}
                style={adminBtnCancel}
              >
                {downloadingPdf ? 'Preparing PDF…' : 'Download as PDF'}
              </button>
              <button
                type="button"
                onClick={() => void handleSendEmail()}
                disabled={sendingEmail || !student.email}
                style={{
                  ...adminBtnPrimary,
                  opacity: sendingEmail || !student.email ? 0.6 : 1,
                  cursor: sendingEmail || !student.email ? 'not-allowed' : 'pointer',
                }}
              >
                {sendingEmail ? 'Sending…' : 'Send as email'}
              </button>
            </>
          )}
          {canGenerate && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={regenerating || codingAttempts === 0}
              style={{
                ...careerReportGreenBtn,
                opacity: regenerating || codingAttempts === 0 ? 0.6 : 1,
                cursor: regenerating || codingAttempts === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {regenerating
                ? 'Queuing…'
                : showRegenerateLabel
                  ? 'Regenerate Career Report'
                  : 'Generate Career Report'}
            </button>
          )}
        </div>
      </div>

      <div ref={reportRef} style={{ ...cardStyle, marginTop: '1.25rem', fontSize: '1.05rem' }}>
        <h2 className="pdf-block" style={{ fontSize: '1.4rem', margin: '0 0 0.85rem' }}>
          Industry-ready career report
        </h2>

        {careerReview.status && (
          <p className="pdf-block" style={{ margin: '0 0 0.85rem', ...smallMuted }}>
            Status: <strong>{careerReview.status}</strong>
            {careerReview.generatedAt &&
              careerReview.status === 'ready' &&
              ` · Generated ${new Date(careerReview.generatedAt).toLocaleString()}`}
            {isV2 ? ' · v2 industry format' : report ? ' · legacy format (regenerate for v2)' : ''}
          </p>
        )}

        {!careerReview.status && (
          <p style={{ margin: 0, ...bodyText, color: 'var(--color-text-muted)' }}>
            No report yet. Generate one for placement-ready insights across all coding tests.
          </p>
        )}

        {(careerReview.status === 'queued' || careerReview.status === 'generating') && (
          <p style={{ margin: 0, ...bodyText, color: 'var(--color-text-muted)' }}>
            Generating report… (auto-refreshes). If stuck over 2 minutes, click Regenerate.
          </p>
        )}

        {careerReview.status === 'failed' && (
          <p style={{ margin: 0, ...bodyText, color: '#ef4444' }}>
            Report failed{careerReview.error ? `: ${careerReview.error}` : '.'} Click Regenerate.
          </p>
        )}

        {isV2 && <IndustryCareerReport report={report} />}
        {report && !isV2 && <LegacyCareerReport report={report as AiCareerReviewLegacy} />}
      </div>
    </div>
  );
}

function IndustryCareerReport({ report }: { report: AiCareerReviewPayload }) {
  const scores = [
    { label: 'Logic', value: report.competencyScores.logic },
    { label: 'Code quality', value: report.competencyScores.codeQuality },
    { label: 'Speed', value: report.competencyScores.speed },
    { label: 'Language versatility', value: report.competencyScores.languageVersatility },
  ];

  return (
    <>
      <p className="pdf-block" style={{ margin: '0 0 1.35rem', ...bodyText }}>
        {report.executiveSummary}
      </p>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="pdf-block" style={sectionTitle}>Executive competency snapshot</h3>
        <div className="pdf-block" style={{ display: 'grid', gap: '0.5rem' }}>
          {scores.map((s) => (
            <ScoreBar key={s.label} label={s.label} value={s.value} max={10} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="pdf-block" style={sectionTitle}>
          1. Language agility & paradigm evaluation
          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            {' '}
            · Versatility {report.languageAgility.versatilityScore}/10
          </span>
        </h3>
        <p className="pdf-block" style={{ margin: '0 0 0.75rem', ...bodyText }}>
          {report.languageAgility.versatilityJustification}
        </p>
        <p className="pdf-block" style={{ margin: '0 0 0.75rem', ...bodyText }}>
          <strong>Paradigm evaluation:</strong> {report.languageAgility.paradigmEvaluation}
        </p>
        <div className="pdf-block" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {report.languageAgility.languageProficiency.map((lp) => (
            <span
              key={lp.language}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                fontSize: '0.95rem',
                background: 'var(--color-bg)',
              }}
            >
              {lp.language}: {lp.proficiencyLevel} ({lp.fluencyScore}/10)
            </span>
          ))}
        </div>
        {report.languageAgility.languageProficiency.map((lp) => (
          <div key={`${lp.language}-detail`} className="pdf-block" style={{ marginBottom: '0.5rem', ...bodyText }}>
            <strong>{lp.language}:</strong> {lp.idiomaticUsage} {lp.paradigmNotes}
          </div>
        ))}
        <p className="pdf-block" style={{ margin: '0.5rem 0 0', ...bodyText }}>
          <strong>Data structures:</strong> {report.languageAgility.coreCsConcepts.dataStructures}
        </p>
        <p className="pdf-block" style={{ margin: '0.25rem 0 0', ...bodyText }}>
          <strong>Algorithms:</strong> {report.languageAgility.coreCsConcepts.algorithms}
        </p>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="pdf-block" style={sectionTitle}>2. Production code quality</h3>
        <TextBlock label="Readability & maintainability" text={report.codeQuality.readabilityAndMaintainability} />
        <TextBlock label="Naming conventions" text={report.codeQuality.namingConventions} />
        <TextBlock label="Modularity" text={report.codeQuality.modularity} />
        <TextBlock label="Robustness & edge cases" text={report.codeQuality.robustnessAndEdgeCases} />
        <TextBlock label="Best practices" text={report.codeQuality.bestPractices} />
        <ListSection title="Code smells" items={report.codeQuality.codeSmells} color="#f59e0b" />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="pdf-block" style={sectionTitle}>3. Algorithmic efficiency</h3>
        <p className="pdf-block" style={{ margin: '0 0 0.75rem', ...bodyText }}>{report.algorithmicEfficiency.summary}</p>
        {report.algorithmicEfficiency.problemAnalyses.map((p) => (
          <div
            key={p.problemTitle}
            className="pdf-block"
            style={{
              marginBottom: '0.5rem',
              padding: '0.75rem',
              background: 'var(--color-bg)',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              ...bodyText,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '1.08rem' }}>
              {p.problemTitle} ({p.language}) · Optimization {p.optimizationScore}/10
            </div>
            <div style={{ color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
              Time {p.timeComplexity} · Space {p.spaceComplexity}
            </div>
            <div style={{ marginTop: '0.35rem' }}>{p.optimizationGap}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="pdf-block" style={sectionTitle}>4. Behavioral patterns</h3>
        <TextBlock label="Debugging efficiency" text={report.behavioralPatterns.debuggingEfficiency} />
        <TextBlock label="Time management" text={report.behavioralPatterns.timeManagement} />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <h3 className="pdf-block" style={sectionTitle}>5. Industry fitment</h3>
        <p
          className="pdf-block"
          style={{
            margin: '0 0 0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'rgba(34,197,94,0.1)',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: '1.1rem',
          }}
        >
          {report.industryFitment.employabilityTag}
        </p>
        {report.industryFitment.roleMappings.map((r) => (
          <div key={r.role} className="pdf-block" style={{ marginBottom: '0.5rem', ...bodyText }}>
            <strong>
              {r.role}
            </strong>
            <FitBadge level={r.fitLevel} /> — {r.rationale}
          </div>
        ))}
        <p className="pdf-block" style={{ margin: '0.75rem 0 0', ...bodyText }}>
          <strong>Skill gap analysis:</strong> {report.industryFitment.skillGapAnalysis}
        </p>
      </div>

      <div>
        <h3 className="pdf-block" style={sectionTitle}>6. 4-week skill gap roadmap</h3>
        {report.fourWeekRoadmap
          .slice()
          .sort((a, b) => a.week - b.week)
          .map((w) => (
            <div key={w.week} className="pdf-block" style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, fontSize: '1.08rem' }}>
                Week {w.week}: {w.focus}
              </div>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', ...bodyText }}>
                {w.tasks.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </>
  );
}

function LegacyCareerReport({ report }: { report: AiCareerReviewLegacy }) {
  return (
    <>
      <p className="pdf-block" style={{ margin: '0 0 0.75rem', ...smallMuted }}>
        This is an older report format. Regenerate to get the industry-ready v2 report.
      </p>
      <p className="pdf-block" style={{ margin: '0 0 1rem', ...bodyText }}>{report.overallSummary}</p>
      <ListSection title="Strengths" items={report.strengths} color="#22c55e" />
      <ListSection title="Weaknesses" items={report.weaknesses} color="#f59e0b" />
      <ListSection title="Recommendations" items={report.recommendations} />
    </>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ fontSize: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>
          {value}/{max}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

function FitBadge({ level }: { level: string }) {
  const color =
    level === 'Strong' ? '#22c55e' : level === 'Moderate' ? '#f59e0b' : 'var(--color-text-muted)';
  return (
    <span style={{ marginLeft: '0.35rem', fontSize: '0.95rem', color, fontWeight: 600 }}>
      [{level}]
    </span>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <p className="pdf-block" style={{ margin: '0 0 0.5rem', ...bodyText }}>
      <strong>{label}:</strong> {text}
    </p>
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
    <div className="pdf-block" style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 600, fontSize: '1.05rem', color, marginBottom: '0.25rem' }}>
        {title}
      </div>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', ...bodyText }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
