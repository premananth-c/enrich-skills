import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatStatusLabel } from '../lib/status';
import { formatAttemptFraction, formatReportResult } from '../lib/reportDisplay';
import {
  downloadXlsxWorkbook,
  reportAttemptsToFlatRows,
  sanitizeReportFilename,
} from '../lib/reportExport';

interface ReportAttemptRow {
  id: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  status: string;
  attemptNumber: number;
  maxAttempts: number;
  result: 'passed' | 'failed' | null;
  user: { id: string; name: string; email: string };
  test: { id: string; title: string };
}

interface StudentReport {
  user: { id: string; name: string; email: string };
  batches: { id: string; batch: { id: string; name: string } }[];
  courseAssignments: { id: string; course: { id: string; title: string }; batch: { id: string; name: string } | null }[];
  attempts: ReportAttemptRow[];
}

interface Props {
  userId: string;
  onClose: () => void;
}

export default function StudentReportPanel({ userId, onClose }: Props) {
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<StudentReport>(`/reports?type=student&userId=${userId}`)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const exportXlsx = () => {
    if (!report) return;
    const date = new Date().toISOString().slice(0, 10);
    const { user, batches, courseAssignments, attempts } = report;
    const summaryRows = [
      { Field: 'Name', Value: user.name },
      { Field: 'Email', Value: user.email },
      { Field: 'Batches', Value: batches.map((b) => b.batch.name).join('; ') || '—' },
      { Field: 'Courses', Value: courseAssignments.map((a) => `${a.course.title}${a.batch ? ` (${a.batch.name})` : ''}`).join('; ') || '—' },
    ];
    const attemptRows = attempts.length > 0 ? reportAttemptsToFlatRows(attempts) : [];
    downloadXlsxWorkbook(
      [
        { name: 'Summary', rows: summaryRows },
        ...(attemptRows.length > 0 ? [{ name: 'Attempts', rows: attemptRows }] : []),
      ],
      `${sanitizeReportFilename(`reports-student-${user.name}-${date}`)}.xlsx`
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, width: '90vw', maxWidth: 800, maxHeight: '85vh', overflow: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{report ? `${report.user.name} – Report` : 'Student Report'}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {report && (
              <button type="button" onClick={exportXlsx} style={{ padding: '0.4rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>Export XLSX</button>
            )}
            <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Close</button>
          </div>
        </div>

        {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
        {!loading && !report && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Could not load report for this student.</div>}

        {!loading && report && (
          <>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{report.user.email}</p>

            <section style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Batches assigned</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {report.batches.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>None</li>}
                {report.batches.map((b) => <li key={b.id}>{b.batch.name}</li>)}
              </ul>
            </section>

            <section style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Courses assigned</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {report.courseAssignments.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>None</li>}
                {report.courseAssignments.map((a) => <li key={a.id}>{a.course.title}{a.batch ? ` (Batch: ${a.batch.name})` : ''}</li>)}
              </ul>
            </section>

            <section>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Tests taken & scores</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Test</th>
                    <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Attempts</th>
                    <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Result</th>
                    <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Score</th>
                    <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {report.attempts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.5rem' }}>{a.test.title}</td>
                      <td style={{ padding: '0.5rem' }}>{formatAttemptFraction(a.attemptNumber, a.maxAttempts)}</td>
                      <td style={{ padding: '0.5rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: a.status === 'submitted' || a.status === 'graded' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(a.status)}</span></td>
                      <td style={{ padding: '0.5rem' }}>{formatReportResult(a.result)}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{a.score != null && a.maxScore != null ? `${a.score} / ${a.maxScore}` : '--'}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.attempts.length === 0 && <div style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>No test attempts yet.</div>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
