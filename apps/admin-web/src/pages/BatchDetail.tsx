import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api, apiUpload } from '../lib/api';
import { formatStatusLabel } from '../lib/status';
import { formatAttemptFraction, formatReportResult } from '../lib/reportDisplay';
import { downloadXlsxRows, reportAttemptsToFlatRows, sanitizeReportFilename } from '../lib/reportExport';
import { emitToast } from '../lib/toast';
import { parseEmailsFromSpreadsheetBuffer } from '../lib/spreadsheetEmails';
import { StudentSearchCombobox } from '../components/StudentSearchCombobox';
import {
  adminBtnCancel,
  adminBtnCancelSm,
  adminBtnDestructiveTable,
  adminBtnPrimary,
  adminBtnPrimaryDisabled,
  adminBtnPrimarySm,
} from '../lib/adminButtonStyles';

type Tab = 'members' | 'calendar' | 'notes' | 'videos' | 'assignments' | 'tests' | 'reports';

interface BatchInfo {
  id: string;
  name: string;
  description: string | null;
  members: { id: string; user: { id: string; email: string; name: string } }[];
}

interface ScheduleEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type: string | null;
  location: string | null;
  course?: { id: string; title: string };
}

interface SchedulerNoteType {
  id: string;
  date: string;
  content: string;
  author: { name: string };
}

interface BatchVideoType {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

interface CourseAssignmentType {
  id: string;
  course: { id: string; title: string };
  dueDate: string | null;
}

interface BatchTestAssignmentType {
  id: string;
  testId: string;
  test: { id: string; title: string; type: string; status: string };
}

interface BatchReportAttempt {
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

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };

export default function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('members');

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [eventForm, setEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', startAt: '', endAt: '', type: '', location: '' });
  const [students, setStudents] = useState<{ id: string; email: string; name: string }[]>([]);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [currentNote, setCurrentNote] = useState<SchedulerNoteType | null>(null);
  const [videos, setVideos] = useState<BatchVideoType[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [assignments, setAssignments] = useState<CourseAssignmentType[]>([]);
  const [assignCourseOpen, setAssignCourseOpen] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState('');
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDayForNote, setSelectedDayForNote] = useState<string | null>(null);
  const [batchTests, setBatchTests] = useState<BatchTestAssignmentType[]>([]);
  const [allTests, setAllTests] = useState<{ id: string; title: string; type: string; status: string }[]>([]);
  const [assignTestOpen, setAssignTestOpen] = useState(false);
  const [assignTestId, setAssignTestId] = useState('');
  const [reportAttempts, setReportAttempts] = useState<BatchReportAttempt[]>([]);
  const [bulkMembersFile, setBulkMembersFile] = useState<File | null>(null);
  const [bulkMembersBusy, setBulkMembersBusy] = useState(false);
  const [bulkMembersProgress, setBulkMembersProgress] = useState('');
  const [inviteMemberEmail, setInviteMemberEmail] = useState('');
  const [inviteMemberSending, setInviteMemberSending] = useState(false);
  const [inviteMemberError, setInviteMemberError] = useState('');

  useEffect(() => {
    if (!id) return;
    api<BatchInfo>(`/batches/${id}`)
      .then(setBatch)
      .catch(() => setBatch(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || tab !== 'calendar') return;
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0, 23, 59, 59);
    api<ScheduleEvent[]>(`/schedule/batches/${id}/events?from=${start.toISOString()}&to=${end.toISOString()}`).then(setEvents).catch(() => setEvents([]));
  }, [id, tab, calendarMonth]);

  useEffect(() => {
    if (!id || tab !== 'tests') return;
    api<BatchTestAssignmentType[]>(`/batches/${id}/tests`).then(setBatchTests).catch(() => setBatchTests([]));
  }, [id, tab]);

  useEffect(() => {
    if (tab !== 'tests' || !assignTestOpen) return;
    api<{ id: string; title: string; type: string; status: string }[]>('/tests')
      .then((data) => setAllTests(data.filter((t) => t.status === 'published')))
      .catch(() => setAllTests([]));
  }, [tab, assignTestOpen]);

  useEffect(() => {
    if (!id || tab !== 'reports') return;
    api<{ batch: BatchInfo; attempts: BatchReportAttempt[] }>(`/reports?type=batch&batchId=${id}`)
      .then((r) => setReportAttempts(r.attempts))
      .catch(() => setReportAttempts([]));
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== 'members') return;
    api<{ id: string; email: string; name: string }[]>('/users?role=student').then(setStudents).catch(() => setStudents([]));
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== 'videos') return;
    api<BatchVideoType[]>(`/schedule/batches/${id}/videos`).then(setVideos).catch(() => setVideos([]));
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== 'assignments') return;
    api<CourseAssignmentType[]>(`/course-assignments?batchId=${id}`).then(setAssignments).catch(() => setAssignments([]));
  }, [id, tab]);

  useEffect(() => {
    if (assignCourseOpen) api<{ id: string; title: string }[]>('/courses').then(setCourses).catch(() => setCourses([]));
  }, [assignCourseOpen]);

  const loadNote = (d: string) => {
    if (!id) return;
    setNoteDate(d);
    setSelectedDayForNote(d);
    setNoteLoading(true);
    api<SchedulerNoteType | null>(`/schedule/batches/${id}/notes?date=${d}`)
      .then((n) => { setCurrentNote(n); setNoteContent(n?.content ?? ''); })
      .catch(() => { setCurrentNote(null); setNoteContent(''); })
      .finally(() => setNoteLoading(false));
  };

  const assignTestToBatch = async () => {
    if (!id || !assignTestId) return;
    try {
      await api(`/batches/${id}/tests`, { method: 'POST', body: JSON.stringify({ testId: assignTestId }) });
      setAssignTestOpen(false);
      setAssignTestId('');
      const list = await api<BatchTestAssignmentType[]>(`/batches/${id}/tests`);
      setBatchTests(list);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Assign failed');
    }
  };

  const exportBatchReportsXlsx = () => {
    if (!batch || reportAttempts.length === 0) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadXlsxRows(
      reportAttemptsToFlatRows(reportAttempts),
      `${sanitizeReportFilename(`reports-batch-${batch.name}-${date}`)}.xlsx`,
      'Batch report'
    );
  };

  const unassignTest = async (testId: string) => {
    if (!id || !confirm('Remove this test from the batch? Students will no longer have it assigned.')) return;
    try {
      await api(`/batches/${id}/tests/${testId}`, { method: 'DELETE' });
      setBatchTests((prev) => prev.filter((t) => t.testId !== testId));
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const saveNote = async () => {
    if (!id || !noteDate) return;
    try {
      await api(`/schedule/batches/${id}/notes`, { method: 'PUT', body: JSON.stringify({ date: noteDate, content: noteContent }) });
      setCurrentNote({ ...currentNote!, content: noteContent, date: noteDate, id: '', author: { name: '' } });
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed to save note');
    }
  };

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api(`/schedule/batches/${id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          title: newEvent.title,
          startAt: new Date(newEvent.startAt).toISOString(),
          endAt: new Date(newEvent.endAt).toISOString(),
          type: newEvent.type || null,
          location: newEvent.location || null,
        }),
      });
      setEventForm(false);
      setNewEvent({ title: '', startAt: '', endAt: '', type: '', location: '' });
      api<ScheduleEvent[]>(`/schedule/batches/${id}/events`).then(setEvents);
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Failed to add event');
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!id || !confirm('Delete this event?')) return;
    try {
      await api(`/schedule/batches/${id}/events/${eventId}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const addMember = async () => {
    if (!id || !addMemberUserId) return;
    try {
      await api(`/batches/${id}/members`, { method: 'POST', body: JSON.stringify({ userId: addMemberUserId }) });
      setAddMemberUserId('');
      const b = await api<BatchInfo>(`/batches/${id}`);
      setBatch(b);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Add failed');
    }
  };

  const inviteMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !inviteMemberEmail.trim()) return;
    setInviteMemberSending(true);
    setInviteMemberError('');
    try {
      await api('/invites', {
        method: 'POST',
        body: JSON.stringify({ email: inviteMemberEmail.trim(), batchId: id }),
      });
      emitToast('success', `Invite sent to ${inviteMemberEmail.trim()}`);
      setInviteMemberEmail('');
    } catch (err) {
      setInviteMemberError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInviteMemberSending(false);
    }
  };

  const bulkAddMembersFromSpreadsheet = async () => {
    if (!id || !bulkMembersFile) {
      emitToast('error', 'Choose a spreadsheet with an Email column.');
      return;
    }
    setBulkMembersBusy(true);
    setBulkMembersProgress('');
    try {
      const buf = await bulkMembersFile.arrayBuffer();
      const parsed = parseEmailsFromSpreadsheetBuffer(buf);
      if (parsed.error) {
        emitToast('error', parsed.error);
        return;
      }
      let added = 0;
      let invited = 0;
      let failed = 0;
      const failures: string[] = [];
      for (let i = 0; i < parsed.emails.length; i++) {
        const email = parsed.emails[i];
        setBulkMembersProgress(`Row ${i + 1} of ${parsed.emails.length}…`);
        const st = students.find((s) => (s.email || '').toLowerCase() === email);
        try {
          if (st) {
            if (batch?.members.some((m) => m.user.id === st.id)) continue;
            await api(`/batches/${id}/members`, { method: 'POST', body: JSON.stringify({ userId: st.id }) });
            added++;
          } else {
            await api('/invites', { method: 'POST', body: JSON.stringify({ email, batchId: id }) });
            invited++;
          }
        } catch (err) {
          failed++;
          failures.push(`${email}: ${err instanceof Error ? err.message : 'failed'}`);
        }
      }
      const b = await api<BatchInfo>(`/batches/${id}`);
      setBatch(b);
      setBulkMembersFile(null);
      emitToast('success', `Bulk add finished: ${added} added to batch, ${invited} invite(s) sent${failed ? `, ${failed} failed` : ''}.`);
      if (failures.length > 0) {
        emitToast('error', failures.slice(0, 3).join(' · ') + (failures.length > 3 ? '…' : ''));
      }
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Could not read file');
    } finally {
      setBulkMembersBusy(false);
      setBulkMembersProgress('');
    }
  };

  const removeMember = async (userId: string) => {
    if (!id || !confirm('Remove this student from the batch?')) return;
    try {
      await api(`/batches/${id}/members/${userId}`, { method: 'DELETE' });
      const b = await api<BatchInfo>(`/batches/${id}`);
      setBatch(b);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const uploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!id || !file) return;
    setVideoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiUpload(`/schedule/batches/${id}/videos`, fd);
      const list = await api<BatchVideoType[]>(`/schedule/batches/${id}/videos`);
      setVideos(list);
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setVideoUploading(false);
      e.target.value = '';
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!id || !confirm('Delete this video?')) return;
    try {
      await api(`/schedule/batches/${id}/videos/${videoId}`, { method: 'DELETE' });
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const assignCourse = async () => {
    if (!id || !assignCourseId) return;
    try {
      await api('/course-assignments', { method: 'POST', body: JSON.stringify({ courseId: assignCourseId, batchId: id }) });
      setAssignCourseOpen(false);
      setAssignCourseId('');
      const list = await api<CourseAssignmentType[]>(`/course-assignments?batchId=${id}`);
      setAssignments(list);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Assign failed');
    }
  };

  const unassignCourse = async (assignmentId: string) => {
    if (!confirm('Remove this course assignment?')) return;
    try {
      await api(`/course-assignments/${assignmentId}`, { method: 'DELETE' });
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Remove failed');
    }
  };

  if (loading || !batch) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'members', label: 'Members' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'notes', label: 'Notes' },
    { key: 'videos', label: 'Videos' },
    { key: 'assignments', label: 'Course assignments' },
    { key: 'tests', label: 'Tests' },
    { key: 'reports', label: 'View reports' },
  ];

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);
  const calendarStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const calendarEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const startPad = (calendarStart.getDay() + 6) % 7;
  const daysInMonth = calendarEnd.getDate();
  const calendarDays: (string | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => toYMD(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), i + 1)))];
  const eventsByDay: Record<string, ScheduleEvent[]> = {};
  events.forEach((ev) => {
    const day = toYMD(new Date(ev.startAt));
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  });

  const membersAvailableStudents = students.filter((s) => !batch.members.some((m) => m.user.id === s.id));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/batches" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>← Batches</Link>
        <h1 style={{ margin: 0 }}>{batch.name}</h1>
        <button type="button" onClick={() => navigate(`/batches/${id}/edit`)} style={adminBtnCancelSm}>Edit</button>
      </div>
      {batch.description && <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{batch.description}</p>}

      <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.5rem 1rem',
              background: tab === t.key ? 'var(--color-primary)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--color-text-muted)',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="batch-add-student-combobox" style={{ ...labelStyle, marginBottom: '0.35rem' }}>Add student</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <StudentSearchCombobox
                id="batch-add-student-combobox"
                options={membersAvailableStudents}
                value={addMemberUserId}
                onChange={setAddMemberUserId}
                maxWidth={280}
                emptyMessage={membersAvailableStudents.length === 0 ? 'No students left to add' : 'No students match'}
              />
              <button type="button" onClick={addMember} disabled={!addMemberUserId} style={adminBtnPrimaryDisabled(!addMemberUserId)}>Add Student</button>
            </div>
          </div>
          <form onSubmit={inviteMemberByEmail} style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, maxWidth: 520 }}>
            <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>Invite by email</div>
            <p style={{ margin: '0 0 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Send a registration invite. When they sign up, they are added to this batch automatically.
            </p>
            {inviteMemberError && (
              <div style={{ padding: '0.45rem 0.6rem', marginBottom: '0.5rem', background: '#ef444422', border: '1px solid #ef444444', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>{inviteMemberError}</div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="email"
                value={inviteMemberEmail}
                onChange={(e) => { setInviteMemberEmail(e.target.value); setInviteMemberError(''); }}
                placeholder="student@example.com"
                style={{ ...inputStyle, flex: '1 1 200px', minWidth: 180, maxWidth: 280 }}
              />
              <button type="submit" disabled={inviteMemberSending || !inviteMemberEmail.trim()} style={adminBtnPrimaryDisabled(inviteMemberSending || !inviteMemberEmail.trim())}>
                {inviteMemberSending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, maxWidth: 520 }}>
            <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>Bulk assign (spreadsheet)</div>
            <p style={{ margin: '0 0 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              File must include a column header named <strong>Email</strong>. Existing students are added to this batch immediately; others receive an invite and join the batch when they register.
            </p>
            {bulkMembersProgress && <div style={{ marginBottom: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{bulkMembersProgress}</div>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => setBulkMembersFile(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, padding: '0.35rem', flex: '1 1 200px', minWidth: 180 }}
              />
              <button
                type="button"
                onClick={bulkAddMembersFromSpreadsheet}
                disabled={bulkMembersBusy || !bulkMembersFile}
                style={adminBtnPrimaryDisabled(bulkMembersBusy || !bulkMembersFile)}
              >
                {bulkMembersBusy ? 'Processing…' : 'Run Bulk Add'}
              </button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Email</th>
                <th style={{ padding: '0.5rem', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {batch.members.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem' }}>{m.user.name}</td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>{m.user.email}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <button type="button" onClick={() => removeMember(m.user.id)} style={adminBtnDestructiveTable}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {batch.members.length === 0 && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No members. Add students above.</div>}
        </div>
      )}

      {tab === 'calendar' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>This calendar is visible to students assigned to this batch. Add events and notes below.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))} style={{ ...adminBtnCancel, padding: '0.35rem 0.75rem', color: 'var(--color-text)' }}>← Prev</button>
            <span style={{ fontWeight: 600, minWidth: 160 }}>{calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))} style={{ ...adminBtnCancel, padding: '0.35rem 0.75rem', color: 'var(--color-text)' }}>Next →</button>
            {!eventForm ? (
              <button type="button" onClick={() => setEventForm(true)} style={adminBtnPrimary}>+ Add Event</button>
            ) : (
              <button type="button" onClick={() => setEventForm(false)} style={adminBtnCancel}>Cancel New Event</button>
            )}
          </div>
          {eventForm && (
            <form onSubmit={addEvent} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 400, marginBottom: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
              <div><label style={labelStyle}>Title</label><input value={newEvent.title} onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))} required style={inputStyle} /></div>
              <div><label style={labelStyle}>Start</label><input type="datetime-local" value={newEvent.startAt} onChange={(e) => setNewEvent((p) => ({ ...p, startAt: e.target.value }))} required style={inputStyle} /></div>
              <div><label style={labelStyle}>End</label><input type="datetime-local" value={newEvent.endAt} onChange={(e) => setNewEvent((p) => ({ ...p, endAt: e.target.value }))} required style={inputStyle} /></div>
              <div><label style={labelStyle}>Type (optional)</label><input value={newEvent.type} onChange={(e) => setNewEvent((p) => ({ ...p, type: e.target.value }))} placeholder="e.g. class, exam" style={inputStyle} /></div>
              <div><label style={labelStyle}>Location (optional)</label><input value={newEvent.location} onChange={(e) => setNewEvent((p) => ({ ...p, location: e.target.value }))} style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={adminBtnPrimary}>Save Event</button>
                <button type="button" onClick={() => setEventForm(false)} style={adminBtnCancel}>Cancel</button>
              </div>
            </form>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: '1rem' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((wd) => (
              <div key={wd} style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{wd}</div>
            ))}
            {calendarDays.map((day, idx) => (
              <div
                key={day ?? `pad-${idx}`}
                style={{
                  minHeight: 88,
                  padding: 4,
                  background: day ? (selectedDayForNote === day ? 'var(--color-primary)' : 'var(--color-bg)') : 'transparent',
                  color: day ? (selectedDayForNote === day ? '#fff' : 'var(--color-text)') : 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  cursor: day ? 'pointer' : 'default',
                }}
                onClick={() => day && loadNote(day)}
              >
                {day && <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{new Date(day + 'T12:00:00').getDate()}</span>}
                {day && eventsByDay[day]?.map((ev) => (
                  <div key={ev.id} style={{ fontSize: '0.7rem', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.title}>{ev.title}</div>
                ))}
              </div>
            ))}
          </div>
          {selectedDayForNote && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>Note for {selectedDayForNote}</strong>
                <button type="button" onClick={() => { setSelectedDayForNote(null); setNoteDate(''); setCurrentNote(null); setNoteContent(''); }} style={{ ...adminBtnCancelSm, padding: '2px 6px' }}>Close</button>
              </div>
              {noteLoading ? <div>Loading...</div> : (
                <>
                  <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={4} style={{ ...inputStyle, marginBottom: '0.5rem' }} placeholder="Note for this day (visible to batch students)" />
                  <button type="button" onClick={saveNote} style={adminBtnPrimary}>Save Note</button>
                </>
              )}
            </div>
          )}
          <div style={{ marginTop: '1rem' }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <strong>{ev.title}</strong>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {new Date(ev.startAt).toLocaleString()} – {new Date(ev.endAt).toLocaleTimeString()}
                    {ev.type && ` · ${ev.type}`}
                    {ev.location && ` · ${ev.location}`}
                  </span>
                </div>
                <button type="button" onClick={() => deleteEvent(ev.id)} style={adminBtnDestructiveTable}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={labelStyle}>Select date:</label>
            <input type="date" value={noteDate} onChange={(e) => loadNote(e.target.value)} style={inputStyle} />
          </div>
          {noteDate && (
            <>
              {noteLoading ? <div>Loading...</div> : (
                <>
                  <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} rows={6} style={inputStyle} placeholder="Note for this day (visible only to this batch)" />
                  <div style={{ marginTop: '0.5rem' }}>
                    <button type="button" onClick={saveNote} style={adminBtnPrimary}>Save Note</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'videos' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ ...labelStyle, display: 'inline-block', marginRight: '0.5rem' }}>Upload recorded video:</label>
            <input type="file" accept="video/*" onChange={uploadVideo} disabled={videoUploading} />
            {videoUploading && <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>Uploading...</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {videos.map((v) => (
              <div key={v.id} style={{ padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{v.title}</strong>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a href={`${import.meta.env.VITE_API_URL ?? ''}/api/v1/schedule/batches/${id}/videos/${v.id}/stream`} target="_blank" rel="noopener noreferrer" style={{ ...adminBtnPrimarySm, textDecoration: 'none', display: 'inline-block' }}>Play</a>
                  <button type="button" onClick={() => deleteVideo(v.id)} style={adminBtnDestructiveTable}>Delete</button>
                </div>
              </div>
            ))}
            {videos.length === 0 && <div style={{ color: 'var(--color-text-muted)' }}>No videos. Upload above.</div>}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <button type="button" onClick={() => setAssignCourseOpen(true)} style={adminBtnPrimary}>Assign Course To Batch</button>
          </div>
          {assignCourseOpen && (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select value={assignCourseId} onChange={(e) => setAssignCourseId(e.target.value)} style={{ ...inputStyle, width: 300 }}>
                <option value="">Select course...</option>
                {courses.filter((c) => !assignments.some((a) => a.course.id === c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <button type="button" onClick={assignCourse} disabled={!assignCourseId} style={adminBtnPrimaryDisabled(!assignCourseId)}>Assign</button>
              <button type="button" onClick={() => { setAssignCourseOpen(false); setAssignCourseId(''); }} style={adminBtnCancel}>Cancel</button>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Course</th>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Due date</th>
                <th style={{ padding: '0.5rem', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem' }}><Link to={`/courses/${a.course.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{a.course.title}</Link></td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</td>
                  <td><button type="button" onClick={() => unassignCourse(a.id)} style={adminBtnDestructiveTable}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 && !assignCourseOpen && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No course assignments.</div>}
        </div>
      )}

      {tab === 'tests' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Assign tests from the test bank to this batch. Assigned tests will be available to all students in the batch.</p>
          <div style={{ marginBottom: '1rem' }}>
            <button type="button" onClick={() => setAssignTestOpen(true)} style={adminBtnPrimary}>Assign Test From Test Bank</button>
          </div>
          {assignTestOpen && (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={assignTestId} onChange={(e) => setAssignTestId(e.target.value)} style={{ ...inputStyle, width: 320 }}>
                <option value="">Select test...</option>
                {allTests.filter((t) => !batchTests.some((bt) => bt.testId === t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
                ))}
              </select>
              <button type="button" onClick={assignTestToBatch} disabled={!assignTestId} style={adminBtnPrimaryDisabled(!assignTestId)}>Assign</button>
              <button type="button" onClick={() => { setAssignTestOpen(false); setAssignTestId(''); }} style={adminBtnCancel}>Cancel</button>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Test</th>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Type</th>
                <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.5rem', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {batchTests.map((bt) => (
                <tr key={bt.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem' }}><Link to={`/tests/${bt.testId}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>{bt.test.title}</Link></td>
                  <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>{bt.test.type}</td>
                  <td style={{ padding: '0.5rem' }}><span style={{ padding: '2px 6px', borderRadius: 4, background: bt.test.status === 'published' ? 'rgba(34,197,94,0.2)' : 'var(--color-bg)', fontSize: '0.8rem' }}>{formatStatusLabel(bt.test.status)}</span></td>
                  <td><button type="button" onClick={() => unassignTest(bt.testId)} style={adminBtnDestructiveTable}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {batchTests.length === 0 && !assignTestOpen && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No tests assigned. Assign from the test bank above.</div>}
        </div>
      )}

      {tab === 'reports' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Batch progress & test scores</h3>
            {reportAttempts.length > 0 && (
              <button type="button" onClick={exportBatchReportsXlsx} style={adminBtnPrimary}>
                Export To XLSX
              </button>
            )}
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Attempts and scores for students in this batch.</p>
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
              {reportAttempts.map((a) => (
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
          {reportAttempts.length === 0 && <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No attempts yet. Assign tests to the batch and students will see them here once they take tests.</div>}
        </div>
      )}
    </div>
  );
}
