import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatStatusLabel } from '../lib/status';

type ReportView = 'batch' | 'test' | 'student';

interface BatchOption {
  id: string;
  name: string;
}

interface TestOption {
  id: string;
  title: string;
}

interface AttemptRow {
  id: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  status: string;
  user: { id: string; name: string; email: string };
  test: { id: string; title: string };
}

interface StudentReport {
  user: { id: string; name: string; email: string };
  batches: { id: string; batch: { id: string; name: string } }[];
  courseAssignments: { id: string; course: { id: string; title: string }; batch: { id: string; name: string } | null }[];
  attempts: { id: string; startedAt: string; submittedAt: string | null; score: number | null; maxScore: number | null; status: string; test: { id: string; title: string } }[];
}

export default function Reports() {
  const [view, setView] = useState<ReportView>('batch');
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [testFilterBatchId, setTestFilterBatchId] = useState('');
  const [testFilterUserId, setTestFilterUserId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentUserId, setStudentUserId] = useState('');
  const [batchAttempts, setBatchAttempts] = useState<AttemptRow[]>([]);
  const [testAttempts, setTestAttempts] = useState<AttemptRow[]>([]);
  const [testBatches, setTestBatches] = useState<BatchOption[]>([]);
  const [studentReport, setStudentReport] = useState<StudentReport | null>(null);
  const [studentSearchResults, setStudentSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ id: string; name: string }[]>('/batches').then((b) => setBatches(b.map((x) => ({ id: x.id, name: x.name })))).catch(() => setBatches([]));
    api<{ id: string; title: string }[]>('/tests').then((t) => setTests(t.map((x) => ({ id: x.id, title: x.title })))).catch(() => setTests([]));
  }, []);

  useEffect(() => {
    if (view !== 'batch' || !selectedBatchId) {
      setBatchAttempts([]);
      return;
    }
    setLoading(true);
    api<{ batch: unknown; attempts: AttemptRow[] }>(`/reports?type=batch&batchId=${selectedBatchId}`)
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
    api<{ test: TestOption; attempts: AttemptRow[]; batches: BatchOption[] }>(`/reports?${params}`)
      .then((r) => {
        setTestAttempts(r.attempts);
        setTestBatches(r.batches ?? []);
      })
      .catch(() => { setTestAttempts([]); setTestBatches([]); })
      .finally(() => setLoading(false));
  }, [view, selectedTestId, testFilterBatchId, testFilterUserId]);

  const searchStudent = () => {
    if (!studentSearch.trim()) return;
    setLoading(true);
    api<{ search?: boolean; users?: { id: string; name: string; email: string }[]; user?: unknown; batches?: unknown[]; courseAssignments?: unknown[]; attempts?: unknown[] }>(`/reports?type=student&q=${encodeURIComponent(studentSearch.trim())}`)
      .then((r) => {
        if (r.search && r.users) {
          setStudentSearchResults(r.users);
          setStudentReport(null);
          if (r.users.length === 1) {
            setStudentUserId(r.users[0].id);
            return api<StudentReport>(`/reports?type=student&userId=${r.users[0].id}`).then((report) => {
              setStudentReport(report);
              setStudentSearchResults([]);
            });
          }
        } else {
          setStudentSearchResults([]);
          setStudentReport(r as unknown as StudentReport);
        }
      })
      .catch(() => { setStudentSearchResults([]); setStudentReport(null); })
      .finally(() => setLoading(false));
  };

  const loadStudentReport = (userId: string) => {
    setStudentUserId(userId);
    setLoading(true);
    api<StudentReport>(`/reports?type=student&userId=${userId}`)
      .then(setStudentReport)
      .catch(() => setStudentReport(null))
      .finally(() => setLoading(false));
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
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Select batch:</label>
            <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, minWidth: 260 }}>
              <option value="">-- Choose batch --</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
          {!loading && selectedBatchId && (
            <>
              <h3 style={{ margin: '0 0 0.75rem' }}>Batch report – progress & test scores</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Student</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Test</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Score</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Started</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {batchAttempts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{a.user.name}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{a.test.title}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: a.status === 'submitted' || a.status === 'graded' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(a.status)}</span></td>
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
          <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Test:</label>
              <select value={selectedTestId} onChange={(e) => setSelectedTestId(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, minWidth: 240 }}>
                <option value="">-- Choose test --</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            {selectedTestId && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>Filter by batch:</label>
                  <select value={testFilterBatchId} onChange={(e) => setTestFilterBatchId(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, minWidth: 200 }}>
                    <option value="">All batches</option>
                    {testBatches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
          {!loading && selectedTestId && (
            <>
              <h3 style={{ margin: '0 0 0.75rem' }}>Test report – all attempts (filter by batch or student)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Student</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Test</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Score</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Started</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {testAttempts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{a.user.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>({a.user.email})</span></td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{a.test.title}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: a.status === 'submitted' || a.status === 'graded' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(a.status)}</span></td>
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
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchStudent()}
              placeholder="Search by name or email"
              style={{ padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, minWidth: 260 }}
            />
            <button onClick={searchStudent} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6 }}>Search</button>
          </div>
          {studentSearchResults.length > 1 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Multiple matches – select a student:</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {studentSearchResults.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => loadStudentReport(u.id)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', textAlign: 'left', width: '100%' }}>{u.name} ({u.email})</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {loading && <div style={{ padding: '1rem' }}>Loading...</div>}
          {!loading && studentReport && (
            <>
              <h3 style={{ margin: '0 0 0.75rem' }}>{studentReport.user.name} – Complete report</h3>
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
                      <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Status</th>
                      <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Score</th>
                      <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentReport.attempts.map((a) => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.5rem' }}>{a.test.title}</td>
                        <td style={{ padding: '0.5rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: a.status === 'submitted' || a.status === 'graded' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(a.status)}</span></td>
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
          {!studentReport && !loading && studentSearchResults.length <= 1 && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Search for a student by name or email to view their complete report.</div>}
        </div>
      )}
    </div>
  );
}
