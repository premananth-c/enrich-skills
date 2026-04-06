import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatStatusLabel } from '../lib/status';
import { formatAttemptFraction, formatReportResult } from '../lib/reportDisplay';
import {
  downloadXlsxRows,
  downloadXlsxWorkbook,
  reportAttemptsToFlatRows,
  sanitizeReportFilename,
} from '../lib/reportExport';
import { StudentSearchCombobox } from '../components/StudentSearchCombobox';
import { SearchablePickerCombobox } from '../components/SearchablePickerCombobox';

type ReportView = 'batch' | 'test' | 'student';

interface BatchOption {
  id: string;
  name: string;
}

interface TestOption {
  id: string;
  title: string;
}

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

export default function Reports() {
  const [view, setView] = useState<ReportView>('batch');
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [testFilterBatchId, setTestFilterBatchId] = useState('');
  const [testFilterUserId, setTestFilterUserId] = useState('');
  const [studentUserId, setStudentUserId] = useState('');
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([]);
  const [batchAttempts, setBatchAttempts] = useState<ReportAttemptRow[]>([]);
  const [testAttempts, setTestAttempts] = useState<ReportAttemptRow[]>([]);
  const [testBatches, setTestBatches] = useState<BatchOption[]>([]);
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const studentReportLoadId = useRef(0);

  useEffect(() => {
    api<{ id: string; name: string }[]>('/batches').then((b) => setBatches(b.map((x) => ({ id: x.id, name: x.name })))).catch(() => setBatches([]));
    api<{ id: string; title: string; status: string }[]>('/tests')
      .then((t) => setTests(t.filter((x) => x.status === 'published').map((x) => ({ id: x.id, title: x.title }))))
      .catch(() => setTests([]));
    api<{ id: string; name: string; email: string | null }[]>('/users?role=student')
      .then((u) => setStudents(u.map((x) => ({ id: x.id, name: x.name, email: x.email ?? '' }))))
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    setTestFilterBatchId('');
    setTestFilterUserId('');
  }, [selectedTestId]);

  useEffect(() => {
    if (view !== 'batch' || !selectedBatchId) {
      setBatchAttempts([]);
      return;
    }
    setLoading(true);
    api<{ batch: unknown; attempts: ReportAttemptRow[] }>(`/reports?type=batch&batchId=${selectedBatchId}`)
      .then((r) => setBatchAttempts(r.attempts))
      .catch(() => setBatchAttempts([]))
      .finally(() => setLoading(false));
  }, [view, selectedBatchId]);

  useEffect(() => {
    if (view !== 'test' || !selectedTestId) {
      setTestAttempts([]);
      setTestBatches([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ type: 'test', testId: selectedTestId });
    if (testFilterBatchId) params.set('batchId', testFilterBatchId);
    if (testFilterUserId) params.set('userId', testFilterUserId);
    api<{ test: TestOption; attempts: ReportAttemptRow[]; batches: BatchOption[] }>(`/reports?${params}`)
      .then((r) => {
        setTestAttempts(r.attempts);
        setTestBatches(r.batches ?? []);
      })
      .catch(() => { setTestAttempts([]); setTestBatches([]); })
      .finally(() => setLoading(false));
  }, [view, selectedTestId, testFilterBatchId, testFilterUserId]);

  const loadStudentReport = (userId: string) => {
    const loadId = ++studentReportLoadId.current;
    setLoading(true);
    api<StudentReport>(`/reports?type=student&userId=${userId}`)
      .then((report) => {
        if (loadId !== studentReportLoadId.current) return;
        setStudentReport(report);
      })
      .catch(() => {
        if (loadId !== studentReportLoadId.current) return;
        setStudentReport(null);
      })
      .finally(() => {
        if (loadId !== studentReportLoadId.current) return;
        setLoading(false);
      });
  };

  const onStudentReportPick = (userId: string) => {
    setStudentUserId(userId);
    if (!userId) {
      studentReportLoadId.current += 1;
      setStudentReport(null);
      setLoading(false);
      return;
    }
    loadStudentReport(userId);
  };

  const exportBatchXlsx = () => {
    if (batchAttempts.length === 0) return;
    const batchName = batches.find((b) => b.id === selectedBatchId)?.name ?? 'batch';
    const date = new Date().toISOString().slice(0, 10);
    downloadXlsxRows(
      reportAttemptsToFlatRows(batchAttempts),
      `${sanitizeReportFilename(`reports-batch-${batchName}-${date}`)}.xlsx`,
      'Batch report'
    );
  };

  const exportTestXlsx = () => {
    if (testAttempts.length === 0) return;
    const testTitle = tests.find((t) => t.id === selectedTestId)?.title ?? 'test';
    const batchPart = testFilterBatchId
      ? testBatches.find((b) => b.id === testFilterBatchId)?.name ?? 'batch-filter'
      : 'all-batches';
    const date = new Date().toISOString().slice(0, 10);
    downloadXlsxRows(
      reportAttemptsToFlatRows(testAttempts),
      `${sanitizeReportFilename(`reports-test-${testTitle}-${batchPart}-${date}`)}.xlsx`,
      'Test report'
    );
  };

  const exportStudentXlsx = () => {
    if (!studentReport) return;
    const date = new Date().toISOString().slice(0, 10);
    const { user, batches: sb, courseAssignments, attempts } = studentReport;
    const summaryRows = [
      { Field: 'Name', Value: user.name },
      { Field: 'Email', Value: user.email },
      { Field: 'Batches', Value: sb.map((b) => b.batch.name).join('; ') || '—' },
      {
        Field: 'Courses',
        Value:
          courseAssignments.map((a) => `${a.course.title}${a.batch ? ` (${a.batch.name})` : ''}`).join('; ') || '—',
      },
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
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Reports</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>View results by Batch, Test, or Student.</p>

      <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        {(['batch', 'test', 'student'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '0.5rem 1rem',
              background: view === v ? 'var(--color-primary)' : 'transparent',
              color: view === v ? '#fff' : 'var(--color-text-muted)',
              border: 'none',
              borderBottom: view === v ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'batch' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', maxWidth: 360 }}>
            <label htmlFor="reports-batch-picker" style={{ display: 'block', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Select batch</label>
            <SearchablePickerCombobox
              id="reports-batch-picker"
              options={batches.map((b) => ({ id: b.id, label: b.name }))}
              value={selectedBatchId}
              onChange={setSelectedBatchId}
              placeholder="Search batches by name…"
              emptyMessage={batches.length === 0 ? 'No batches' : 'No batches match'}
              maxWidth={360}
            />
          </div>
          {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
          {!loading && selectedBatchId && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Batch report – progress & test scores</h3>
                {batchAttempts.length > 0 && (
                  <button
                    type="button"
                    onClick={exportBatchXlsx}
                    style={{ padding: '0.5rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}
                  >
                    Export to XLSX
                  </button>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Student</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Test</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Attempts</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Result</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Score</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Started</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {batchAttempts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{a.user.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{a.user.email}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{a.test.title}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatAttemptFraction(a.attemptNumber, a.maxAttempts)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: a.status === 'submitted' || a.status === 'graded' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(a.status)}</span></td>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatReportResult(a.result)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{a.score != null && a.maxScore != null ? `${a.score} / ${a.maxScore}` : '--'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{new Date(a.startedAt).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {batchAttempts.length === 0 && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No attempts for this batch.</div>}
            </>
          )}
          {!selectedBatchId && !loading && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Select a batch to see reports.</div>}
        </div>
      )}

      {view === 'test' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}>
              <label htmlFor="reports-test-picker" style={{ display: 'block', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Select test</label>
              <SearchablePickerCombobox
                id="reports-test-picker"
                options={tests.map((t) => ({ id: t.id, label: t.title }))}
                value={selectedTestId}
                onChange={setSelectedTestId}
                placeholder="Search tests by title…"
                emptyMessage={tests.length === 0 ? 'No published tests' : 'No tests match'}
                maxWidth={360}
              />
            </div>
            {selectedTestId && (
              <>
                <div style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 320 }}>
                  <label htmlFor="reports-test-filter-batch" style={{ display: 'block', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Filter by batch</label>
                  <SearchablePickerCombobox
                    id="reports-test-filter-batch"
                    options={[{ id: '', label: 'All batches' }, ...testBatches.map((b) => ({ id: b.id, label: b.name }))]}
                    value={testFilterBatchId}
                    onChange={setTestFilterBatchId}
                    placeholder="All batches"
                    emptyMessage="No batches"
                    maxWidth={320}
                  />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}>
                  <label htmlFor="reports-test-filter-student" style={{ display: 'block', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Filter by student</label>
                  <StudentSearchCombobox
                    id="reports-test-filter-student"
                    options={students}
                    value={testFilterUserId}
                    onChange={setTestFilterUserId}
                    placeholder="Search students…"
                    emptyMessage={students.length === 0 ? 'No students (need Students access)' : 'No students match'}
                    maxWidth={360}
                  />
                </div>
              </>
            )}
          </div>
          {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
          {!loading && selectedTestId && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>Test report – all attempts (filter by batch or student)</h3>
                {testAttempts.length > 0 && (
                  <button
                    type="button"
                    onClick={exportTestXlsx}
                    style={{ padding: '0.5rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}
                  >
                    Export to XLSX
                  </button>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Student</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Email</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Test</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Attempts</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Result</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Score</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Started</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {testAttempts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{a.user.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{a.user.email}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{a.test.title}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatAttemptFraction(a.attemptNumber, a.maxAttempts)}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: a.status === 'submitted' || a.status === 'graded' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(a.status)}</span></td>
                      <td style={{ padding: '0.75rem 1rem' }}>{formatReportResult(a.result)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{a.score != null && a.maxScore != null ? `${a.score} / ${a.maxScore}` : '--'}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{new Date(a.startedAt).toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {testAttempts.length === 0 && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No attempts for this test.</div>}
            </>
          )}
          {!selectedTestId && !loading && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Select a test to see reports.</div>}
        </div>
      )}

      {view === 'student' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', maxWidth: 400 }}>
            <label htmlFor="reports-student-picker" style={{ display: 'block', fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>Select student</label>
            <StudentSearchCombobox
              id="reports-student-picker"
              options={students}
              value={studentUserId}
              onChange={onStudentReportPick}
              placeholder="Search by name or email…"
              emptyMessage={students.length === 0 ? 'No students (need Students access)' : 'No students match'}
              maxWidth={400}
            />
          </div>
          {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
          {!loading && studentReport && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>{studentReport.user.name} – Complete report</h3>
                <button
                  type="button"
                  onClick={exportStudentXlsx}
                  style={{ padding: '0.5rem 1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }}
                >
                  Export to XLSX
                </button>
              </div>
              <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{studentReport.user.email}</p>
              <section style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Batches assigned</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {studentReport.batches.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>None</li>}
                  {studentReport.batches.map((b) => (
                    <li key={b.id}>{b.batch.name}</li>
                  ))}
                </ul>
              </section>
              <section style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Courses assigned</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {studentReport.courseAssignments.length === 0 && <li style={{ color: 'var(--color-text-muted)' }}>None</li>}
                  {studentReport.courseAssignments.map((a) => (
                    <li key={a.id}>{a.course.title}{a.batch ? ` (Batch: ${a.batch.name})` : ''}</li>
                  ))}
                </ul>
              </section>
              <section style={{ marginBottom: '1.5rem' }}>
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
                    {studentReport.attempts.map((a) => (
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
                {studentReport.attempts.length === 0 && <div style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>No test attempts yet.</div>}
              </section>
            </>
          )}
          {!studentReport && !loading && !studentUserId && (
            <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Select a student above to view their complete report.</div>
          )}
          {!studentReport && !loading && studentUserId && (
            <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Could not load report for this student.</div>
          )}
        </div>
      )}
    </div>
  );
}
