import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api, apiUpload } from '../lib/api';
import { RichTextEditor } from '../components/RichTextEditor';
import VideoPlayer from '../components/VideoPlayer';
import { emitToast } from '../lib/toast';
import { startVideoUpload } from '../lib/uploadManager';

interface CourseChapter {
  id: string;
  title: string;
  order: number;
  topics: CourseTopic[];
}

interface CourseTopic {
  id: string;
  title: string;
  order: number;
  content: string | null;
}

interface CourseFull {
  id: string;
  title: string;
  description: string | null;
  chapters: CourseChapter[];
}

interface Material {
  id: string;
  type: string;
  title: string;
  url: string | null;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface Activity {
  id: string;
  type: string;
  title: string;
}

interface Evaluation {
  id: string;
  type: string;
  title: string;
  testId: string | null;
  test?: { id: string; title: string };
}

interface CourseAssignmentItem {
  id: string;
  course: { id: string; title: string };
  batch: { id: string; name: string } | null;
  user: { id: string; email: string; name: string } | null;
  dueDate: string | null;
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };
const addBtnStyle: React.CSSProperties = { padding: '0.4rem 0.75rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.9rem', fontWeight: 500, marginRight: 10 };
const cancelBtnStyle: React.CSSProperties = { padding: '0.4rem 0.75rem', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.9rem' };
const formBlockStyle: React.CSSProperties = { marginTop: '0.5rem', padding: '0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 520 };

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [addChapter, setAddChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [addTopic, setAddTopic] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicContent, setNewTopicContent] = useState('');
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});
  const [activities, setActivities] = useState<Record<string, Activity[]>>({});
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation[]>>({});
  const [tests, setTests] = useState<{ id: string; title: string; type: string; status: string }[]>([]);
  const [addMaterial, setAddMaterial] = useState<string | null>(null);
  const [newMaterial, setNewMaterial] = useState({ type: 'link' as 'pdf' | 'link' | 'video', title: '', url: '' });
  const [addActivity, setAddActivity] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState({ type: 'assignment' as 'assignment' | 'discussion', title: '', description: '' });
  const [addEvaluation, setAddEvaluation] = useState<string | null>(null);
  const [newEvaluation, setNewEvaluation] = useState({ type: 'mcq' as 'mcq' | 'coding', title: '', testId: '' });
  const [evaluationTestFilter, setEvaluationTestFilter] = useState('');
  const [evaluationTestDropdownOpen, setEvaluationTestDropdownOpen] = useState(false);
  const [editTopicContent, setEditTopicContent] = useState<string | null>(null);
  const [editingTopicContent, setEditingTopicContent] = useState('');
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = useState('');
  const [assignments, setAssignments] = useState<CourseAssignmentItem[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; email: string; name: string }[]>([]);
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [assignType, setAssignType] = useState<'batch' | 'student'>('batch');
  const [assignBatchId, setAssignBatchId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');

  const loadCourse = () => {
    if (!id) return;
    api<CourseFull>(`/courses/${id}`).then(setCourse).catch(() => setCourse(null)).finally(() => setLoading(false));
  };

  useEffect(() => { loadCourse(); }, [id]);

  useEffect(() => {
    if (!id) return;
    api<CourseAssignmentItem[]>(`/course-assignments?courseId=${id}`).then(setAssignments).catch(() => setAssignments([]));
  }, [id]);

  useEffect(() => {
    if (addAssignmentOpen) {
      api<{ id: string; name: string }[]>('/batches').then(setBatches).catch(() => setBatches([]));
      api<{ id: string; email: string; name: string }[]>('/users?role=student').then(setStudents).catch(() => setStudents([]));
    }
  }, [addAssignmentOpen]);

  useEffect(() => {
    api<{ id: string; title: string; type: string; status: string }[]>('/tests')
      .then((data) => setTests(data.filter((t) => t.status === 'published')))
      .catch(() => setTests([]));
  }, []);

  const loadTopicExtras = async (topicId: string) => {
    if (!id) return;
    const [ch, , topicIdPart] = course!.chapters.flatMap((ch) => ch.topics.map((t) => [ch.id, ch.id, t.id])).find(([, , t]) => t === topicId) ?? [];
    const chapter = course?.chapters.find((c) => c.id === ch);
    const topic = chapter?.topics.find((t) => t.id === topicId);
    if (!chapter || !topic) return;
    const base = `/courses/${id}/chapters/${chapter.id}/topics/${topicId}`;
    const [mats, acts, evals] = await Promise.all([
      api<Material[]>(`${base}/materials`).catch(() => []),
      api<Activity[]>(`${base}/activities`).catch(() => []),
      api<Evaluation[]>(`${base}/evaluations`).catch(() => []),
    ]);
    setMaterials((p) => ({ ...p, [topicId]: mats }));
    setActivities((p) => ({ ...p, [topicId]: acts }));
    setEvaluations((p) => ({ ...p, [topicId]: evals }));
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopic((p) => (p === topicId ? null : topicId));
    if (!materials[topicId]) loadTopicExtras(topicId);
  };

  const saveChapter = async () => {
    if (!id || !newChapterTitle.trim()) return;
    try {
      await api(`/courses/${id}/chapters`, { method: 'POST', body: JSON.stringify({ title: newChapterTitle }) });
      setNewChapterTitle('');
      setAddChapter(false);
      loadCourse();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveTopic = async (chapterId: string) => {
    if (!id || !newTopicTitle.trim()) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTopicTitle,
          content: newTopicContent.trim() || undefined,
        }),
      });
      setNewTopicTitle('');
      setNewTopicContent('');
      setAddTopic(null);
      loadCourse();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteChapter = async (chapterId: string) => {
    if (!id || !confirm('Delete this chapter and all its topics?')) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}`, { method: 'DELETE' });
      loadCourse();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteTopic = async (chapterId: string, topicId: string) => {
    if (!id || !confirm('Delete this topic?')) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics/${topicId}`, { method: 'DELETE' });
      loadCourse();
      setMaterials((p) => { const next = { ...p }; delete next[topicId]; return next; });
      setActivities((p) => { const next = { ...p }; delete next[topicId]; return next; });
      setEvaluations((p) => { const next = { ...p }; delete next[topicId]; return next; });
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveMaterial = async (topicId: string) => {
    if (!id) return;
    const chapter = course?.chapters.find((c) => c.topics.some((t) => t.id === topicId));
    if (!chapter) return;
    try {
      if (newMaterial.type === 'link') {
        await api(`/courses/${id}/chapters/${chapter.id}/topics/${topicId}/materials`, {
          method: 'POST',
          body: JSON.stringify({ type: 'link', title: newMaterial.title, url: newMaterial.url || null }),
        });
      }
      setAddMaterial(null);
      setNewMaterial({ type: 'link', title: '', url: '' });
      loadTopicExtras(topicId);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const uploadPdf = async (topicId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!id || !file) return;
    const chapter = course?.chapters.find((c) => c.topics.some((t) => t.id === topicId));
    if (!chapter) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiUpload(`/courses/${id}/chapters/${chapter.id}/topics/${topicId}/materials/upload`, fd);
      setAddMaterial(null);
      loadTopicExtras(topicId);
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const handleVideoUpload = (topicId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!id || !file) return;
    const chapter = course?.chapters.find((c) => c.topics.some((t) => t.id === topicId));
    if (!chapter) return;

    setAddMaterial(null);
    setNewMaterial({ type: 'link', title: '', url: '' });
    emitToast('info', `Uploading "${file.name}" — you can navigate away, progress is shown in the bottom-right.`);

    startVideoUpload(id, chapter.id, topicId, file, () => {
      loadTopicExtras(topicId);
    });

    e.target.value = '';
  };

  const deleteMaterial = async (chapterId: string, topicId: string, materialId: string) => {
    if (!id || !confirm('Delete this material?')) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics/${topicId}/materials/${materialId}`, { method: 'DELETE' });
      loadTopicExtras(topicId);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveActivity = async (topicId: string) => {
    if (!id) return;
    const chapter = course?.chapters.find((c) => c.topics.some((t) => t.id === topicId));
    if (!chapter) return;
    try {
      await api(`/courses/${id}/chapters/${chapter.id}/topics/${topicId}/activities`, {
        method: 'POST',
        body: JSON.stringify({ type: newActivity.type, title: newActivity.title, config: newActivity.description.trim() ? { description: newActivity.description.trim() } : {} }),
      });
      setAddActivity(null);
      setNewActivity({ type: 'assignment', title: '', description: '' });
      loadTopicExtras(topicId);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteActivity = async (chapterId: string, topicId: string, activityId: string) => {
    if (!id || !confirm('Delete this activity?')) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics/${topicId}/activities/${activityId}`, { method: 'DELETE' });
      loadTopicExtras(topicId);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const saveEvaluation = async (topicId: string) => {
    if (!id) return;
    const title = newEvaluation.title.trim();
    if (!title) {
      emitToast('error', 'Please enter a title for the evaluation.');
      return;
    }
    const chapter = course?.chapters.find((c) => c.topics.some((t) => t.id === topicId));
    if (!chapter) return;
    try {
      await api(`/courses/${id}/chapters/${chapter.id}/topics/${topicId}/evaluations`, {
        method: 'POST',
        body: JSON.stringify({
          type: newEvaluation.type === 'mcq' ? 'quiz' : 'test',
          title,
          testId: newEvaluation.testId || null,
        }),
      });
      setAddEvaluation(null);
      setNewEvaluation({ type: 'mcq', title: '', testId: '' });
      setEvaluationTestFilter('');
      setEvaluationTestDropdownOpen(false);
      loadTopicExtras(topicId);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteEvaluation = async (chapterId: string, topicId: string, evaluationId: string) => {
    if (!id || !confirm('Delete this evaluation?')) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics/${topicId}/evaluations/${evaluationId}`, { method: 'DELETE' });
      loadTopicExtras(topicId);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEditTopicContent = (topic: CourseTopic) => {
    setEditTopicContent(topic.id);
    setEditingTopicContent(topic.content || '');
  };

  const saveTopicContent = async (chapterId: string, topicId: string) => {
    if (!id) return;
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics/${topicId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editingTopicContent || null }),
      });
      setEditTopicContent(null);
      setEditingTopicContent('');
      loadCourse();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEditChapterTitle = (ch: CourseChapter) => {
    setEditingChapterId(ch.id);
    setEditingChapterTitle(ch.title);
  };

  const saveChapterTitle = async (chapterId: string) => {
    const title = editingChapterTitle.trim();
    if (!id || !title) {
      setEditingChapterId(null);
      setEditingChapterTitle('');
      return;
    }
    const ch = course?.chapters.find((c) => c.id === chapterId);
    if (ch && ch.title === title) {
      setEditingChapterId(null);
      setEditingChapterTitle('');
      return;
    }
    try {
      await api(`/courses/${id}/chapters/${chapterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      setEditingChapterId(null);
      setEditingChapterTitle('');
      loadCourse();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const startEditTopicTitle = (topic: CourseTopic) => {
    setEditingTopicId(topic.id);
    setEditingTopicTitle(topic.title);
  };

  const saveTopicTitle = async (chapterId: string, topicId: string) => {
    const title = editingTopicTitle.trim();
    if (!id || !title) {
      setEditingTopicId(null);
      setEditingTopicTitle('');
      return;
    }
    const topic = course?.chapters.flatMap((c) => c.topics).find((t) => t.id === topicId);
    if (topic && topic.title === title) {
      setEditingTopicId(null);
      setEditingTopicTitle('');
      return;
    }
    try {
      await api(`/courses/${id}/chapters/${chapterId}/topics/${topicId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      setEditingTopicId(null);
      setEditingTopicTitle('');
      loadCourse();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed');
    }
  };

  const addAssignment = async () => {
    if (!id) return;
    const isBatch = assignType === 'batch';
    if (isBatch && !assignBatchId) {
      emitToast('info', 'Select a batch');
      return;
    }
    if (!isBatch && !assignUserId) {
      emitToast('info', 'Select a student');
      return;
    }
    try {
      await api('/course-assignments', {
        method: 'POST',
        body: JSON.stringify({
          courseId: id,
          batchId: isBatch ? assignBatchId : null,
          userId: isBatch ? null : assignUserId,
          dueDate: assignDueDate.trim() || null,
        }),
      });
      setAddAssignmentOpen(false);
      setAssignBatchId('');
      setAssignUserId('');
      setAssignDueDate('');
      const list = await api<CourseAssignmentItem[]>(`/course-assignments?courseId=${id}`);
      setAssignments(list);
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed to assign');
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    if (!id || !confirm('Remove this assignment?')) return;
    try {
      await api(`/course-assignments/${assignmentId}`, { method: 'DELETE' });
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Failed to remove');
    }
  };

  if (loading || !course) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/courses" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>← Courses</Link>
        <h1 style={{ margin: 0 }}>{course.title}</h1>
        <button onClick={() => navigate(`/courses/${id}/edit`)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Edit</button>
      </div>
      {course.description && <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{course.description}</p>}

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Chapters & topics</h3>
        {course.chapters.map((ch) => (
          <div key={ch.id} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="button" onClick={() => setExpandedChapter((p) => (p === ch.id ? null : ch.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: '1rem' }}>{expandedChapter === ch.id ? '▼' : '▶'}</button>
              {editingChapterId === ch.id ? (
                <input
                  value={editingChapterTitle}
                  onChange={(e) => setEditingChapterTitle(e.target.value)}
                  onBlur={() => saveChapterTitle(ch.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                  autoFocus
                  style={{ ...inputStyle, width: 220, display: 'inline-block', padding: '2px 6px', fontSize: '0.95rem' }}
                />
              ) : (
                <>
                  <strong>Chapter: {ch.title}</strong>
                  <button type="button" onClick={() => startEditChapterTitle(ch)} title="Edit chapter name" style={{ padding: '2px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.9rem' }} aria-label="Edit">✎</button>
                </>
              )}
              <button onClick={() => deleteChapter(ch.id)} style={{ padding: '2px 6px', fontSize: '0.75rem', background: 'transparent', border: '1px solid #ef444444', color: '#f87171', borderRadius: 4 }}>Delete</button>
            </div>
            {expandedChapter === ch.id && (
              <div style={{ marginLeft: '1.5rem' }}>
                {ch.topics.map((topic) => (
                  <div key={topic.id} style={{ marginBottom: '0.75rem', borderLeft: '2px solid var(--color-border)', paddingLeft: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <button type="button" onClick={() => toggleTopic(topic.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', fontSize: '0.9rem' }}>{expandedTopic === topic.id ? '▼' : '▶'}</button>
                      {editingTopicId === topic.id ? (
                        <input
                          value={editingTopicTitle}
                          onChange={(e) => setEditingTopicTitle(e.target.value)}
                          onBlur={() => saveTopicTitle(ch.id, topic.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                          autoFocus
                          style={{ ...inputStyle, width: 200, display: 'inline-block', padding: '2px 6px', fontSize: '0.9rem' }}
                        />
                      ) : (
                        <>
                          <strong style={{ fontSize: '0.95rem' }}>{topic.title}</strong>
                          <button type="button" onClick={() => startEditTopicTitle(topic)} title="Edit topic name" style={{ padding: '2px 4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.85rem' }} aria-label="Edit">✎</button>
                        </>
                      )}
                      <button onClick={() => deleteTopic(ch.id, topic.id)} style={{ padding: '2px 6px', fontSize: '0.75rem', background: 'transparent', border: '1px solid #ef444444', color: '#f87171', borderRadius: 4 }}>Delete</button>
                    </div>
                    {expandedTopic === topic.id && (
                      <div style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <span style={{ color: 'var(--color-text-muted)', marginRight: '0.5rem' }}>Content:</span>
                          {editTopicContent === topic.id ? (
                            <div style={{ marginTop: '0.5rem' }}>
                              <RichTextEditor
                                value={editingTopicContent}
                                onChange={setEditingTopicContent}
                                placeholder="Topic content (rich text)"
                                minHeight="180px"
                              />
                              <div style={{ marginTop: '0.5rem' }}>
                                <button onClick={() => saveTopicContent(ch.id, topic.id)} style={{ padding: '4px 10px', marginRight: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4 }}>Save content</button>
                                <button onClick={() => { setEditTopicContent(null); setEditingTopicContent(''); }} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {topic.content ? (
                                <div
                                  className="rich-text-readonly"
                                  style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'var(--color-bg)', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.9rem', lineHeight: 1.6 }}
                                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(topic.content ?? '') }}
                                />
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No content yet.</span>
                              )}
                              <button onClick={() => startEditTopicContent(topic)} style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)' }}>{topic.content ? 'Edit content' : 'Add content'}</button>
                            </>
                          )}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>Materials</div>
                          {(materials[topic.id] ?? []).map((m) => (
                            <div key={m.id} style={{ marginBottom: m.type === 'video' ? '0.75rem' : '0.25rem' }}>
                              {m.type === 'video' ? (
                                <div>
                                  <VideoPlayer materialId={m.id} title={m.title} />
                                  <button onClick={() => deleteMaterial(ch.id, topic.id, m.id)} style={{ marginTop: 4, padding: '2px 8px', fontSize: '0.75rem', color: '#f87171', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4 }}>Delete video</button>
                                </div>
                              ) : m.type === 'pdf' ? (
                                <>
                                  <Link to={`/pdf/${m.id}?title=${encodeURIComponent(m.title)}&back=${encodeURIComponent(`/courses/${id}`)}`} style={{ color: 'var(--color-primary)' }}>{m.title}</Link>
                                  <button onClick={() => deleteMaterial(ch.id, topic.id, m.id)} style={{ marginLeft: 6, padding: '0 4px', fontSize: '0.75rem', color: '#f87171' }}>×</button>
                                </>
                              ) : (
                                <>
                                  <a href={m.url ?? '#'} target="_blank" rel="noopener noreferrer">{m.title}</a>
                                  <button onClick={() => deleteMaterial(ch.id, topic.id, m.id)} style={{ marginLeft: 6, padding: '0 4px', fontSize: '0.75rem', color: '#f87171' }}>×</button>
                                </>
                              )}
                            </div>
                          ))}
                          {addMaterial === topic.id ? (
                            <div style={formBlockStyle}>
                              <select value={newMaterial.type} onChange={(e) => setNewMaterial((p) => ({ ...p, type: e.target.value as 'pdf' | 'link' | 'video' }))} style={{ ...inputStyle, width: '100%', maxWidth: 140 }}>
                                <option value="link">Link</option>
                                <option value="pdf">PDF</option>
                                <option value="video">Video</option>
                              </select>
                              {newMaterial.type === 'link' ? (
                                <>
                                  <input value={newMaterial.title} onChange={(e) => setNewMaterial((p) => ({ ...p, title: e.target.value }))} placeholder="Title" style={inputStyle} />
                                  <input value={newMaterial.url} onChange={(e) => setNewMaterial((p) => ({ ...p, url: e.target.value }))} placeholder="URL" style={inputStyle} />
                                </>
                              ) : newMaterial.type === 'pdf' ? (
                                <input type="file" accept=".pdf" onChange={(e) => uploadPdf(topic.id, e)} />
                              ) : (
                                <input
                                  type="file"
                                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                                  onChange={(e) => handleVideoUpload(topic.id, e)}
                                />
                              )}
                              <div style={{ display: 'flex', gap: 0, marginTop: '0.25rem' }}>
                                {newMaterial.type !== 'video' && (
                                  <button type="button" onClick={() => saveMaterial(topic.id)} style={addBtnStyle}>Add</button>
                                )}
                                <button type="button" onClick={() => setAddMaterial(null)} style={cancelBtnStyle}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setAddMaterial(topic.id)} style={{ marginTop: '0.25rem', padding: '2px 8px', fontSize: '0.8rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4 }}>+ Material</button>
                          )}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>Activities</div>
                          {(activities[topic.id] ?? []).map((a) => (
                            <div key={a.id} style={{ marginBottom: '0.25rem' }}>
                              {a.title}
                              <button onClick={() => deleteActivity(ch.id, topic.id, a.id)} style={{ marginLeft: 6, fontSize: '0.75rem', color: '#f87171' }}>×</button>
                            </div>
                          ))}
                          {addActivity === topic.id ? (
                            <div style={formBlockStyle}>
                              <input value={newActivity.title} onChange={(e) => setNewActivity((p) => ({ ...p, title: e.target.value }))} placeholder="Title" style={inputStyle} />
                              <select value={newActivity.type} onChange={(e) => setNewActivity((p) => ({ ...p, type: e.target.value as 'assignment' | 'discussion' }))} style={{ ...inputStyle, maxWidth: 160 }}>
                                <option value="assignment">Assignment</option>
                                <option value="discussion">Discussion</option>
                              </select>
                              <div>
                                <label style={labelStyle}>Description (optional)</label>
                                <textarea
                                  value={newActivity.description}
                                  onChange={(e) => setNewActivity((p) => ({ ...p, description: e.target.value }))}
                                  placeholder="Describe the activity..."
                                  rows={3}
                                  style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: 0, marginTop: '0.25rem' }}>
                                <button onClick={() => saveActivity(topic.id)} style={addBtnStyle}>Add</button>
                                <button onClick={() => { setAddActivity(null); setNewActivity({ type: 'assignment', title: '', description: '' }); }} style={cancelBtnStyle}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setAddActivity(topic.id)} style={{ marginTop: '0.25rem', padding: '2px 8px', fontSize: '0.8rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4 }}>+ Activity</button>
                          )}
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.25rem' }}>Evaluations (MCQ / Coding)</div>
                          {(evaluations[topic.id] ?? []).map((ev) => (
                            <div key={ev.id} style={{ marginBottom: '0.25rem' }}>
                              {ev.title} {ev.test && `(${ev.test.title})`}
                              <button onClick={() => deleteEvaluation(ch.id, topic.id, ev.id)} style={{ marginLeft: 6, fontSize: '0.75rem', color: '#f87171' }}>×</button>
                            </div>
                          ))}
                          {addEvaluation === topic.id ? (
                            <div style={formBlockStyle}>
                              <input value={newEvaluation.title} onChange={(e) => setNewEvaluation((p) => ({ ...p, title: e.target.value }))} placeholder="Title" style={inputStyle} />
                              <select
                                value={newEvaluation.type}
                                onChange={(e) => {
                                  const type = e.target.value as 'mcq' | 'coding';
                                  const testsOfType = tests.filter((t) => t.type === type);
                                  const selectedTest = newEvaluation.testId ? testsOfType.find((t) => t.id === newEvaluation.testId) : null;
                                  setNewEvaluation((p) => ({
                                    ...p,
                                    type,
                                    testId: selectedTest ? selectedTest.id : '',
                                    title: selectedTest ? selectedTest.title : p.title,
                                  }));
                                  setEvaluationTestFilter('');
                                  setEvaluationTestDropdownOpen(false);
                                }}
                                style={{ ...inputStyle, maxWidth: 140 }}
                              >
                                <option value="mcq">MCQ</option>
                                <option value="coding">Coding</option>
                              </select>
                              {(() => {
                                const testsOfType = tests.filter((t) => t.type === newEvaluation.type);
                                const filteredBySearch = evaluationTestFilter.trim()
                                  ? testsOfType.filter((t) => t.title.toLowerCase().includes(evaluationTestFilter.trim().toLowerCase()))
                                  : testsOfType;
                                const selectedTest = newEvaluation.testId ? testsOfType.find((t) => t.id === newEvaluation.testId) : null;
                                return (
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="text"
                                      value={evaluationTestDropdownOpen ? evaluationTestFilter : (selectedTest?.title ?? '')}
                                        onChange={(e) => {
                                        setEvaluationTestFilter(e.target.value);
                                        setEvaluationTestDropdownOpen(true);
                                        if (!e.target.value) setNewEvaluation((p) => ({ ...p, testId: '' }));
                                      }}
                                      onFocus={() => {
                                        setEvaluationTestDropdownOpen(true);
                                        if (!evaluationTestFilter && newEvaluation.testId) {
                                          const sel = testsOfType.find((t) => t.id === newEvaluation.testId);
                                          if (sel) setEvaluationTestFilter(sel.title);
                                        }
                                      }}
                                      onBlur={() => setTimeout(() => setEvaluationTestDropdownOpen(false), 150)}
                                      placeholder="Type to search tests..."
                                      style={inputStyle}
                                    />
                                    {evaluationTestDropdownOpen && (
                                      <ul
                                        style={{
                                          position: 'absolute',
                                          zIndex: 10,
                                          top: '100%',
                                          left: 0,
                                          right: 0,
                                          margin: 0,
                                          marginTop: 2,
                                          padding: '0.25rem 0',
                                          maxHeight: 220,
                                          overflow: 'auto',
                                          background: 'var(--color-surface)',
                                          border: '1px solid var(--color-border)',
                                          borderRadius: 8,
                                          listStyle: 'none',
                                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                        }}
                                      >
                                        {filteredBySearch.length === 0 ? (
                                          <li style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No matching tests</li>
                                        ) : (
                                          filteredBySearch.map((t) => (
                                            <li
                                              key={t.id}
                                              onMouseDown={(e) => e.preventDefault()}
                                              onClick={() => {
                                                setNewEvaluation((p) => ({ ...p, testId: t.id, title: t.title }));
                                                setEvaluationTestFilter('');
                                                setEvaluationTestDropdownOpen(false);
                                              }}
                                              style={{
                                                padding: '0.4rem 0.75rem',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                background: newEvaluation.testId === t.id ? 'var(--color-primary)' : 'transparent',
                                                color: newEvaluation.testId === t.id ? '#fff' : 'var(--color-text)',
                                              }}
                                            >
                                              {t.title}
                                            </li>
                                          ))
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })()}
                              <div style={{ display: 'flex', gap: 0, marginTop: '0.25rem' }}>
                                <button onClick={() => saveEvaluation(topic.id)} disabled={!newEvaluation.title.trim()} style={addBtnStyle}>Add</button>
                                <button
                                  onClick={() => {
                                    setAddEvaluation(null);
                                    setNewEvaluation({ type: 'mcq', title: '', testId: '' });
                                    setEvaluationTestFilter('');
                                    setEvaluationTestDropdownOpen(false);
                                  }}
                                  style={cancelBtnStyle}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setAddEvaluation(topic.id)} style={{ marginTop: '0.25rem', padding: '2px 8px', fontSize: '0.8rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4 }}>+ Evaluation</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {addTopic === ch.id ? (
                  <div style={{ marginBottom: '1rem', marginLeft: '0.5rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} placeholder="Topic title" style={{ ...inputStyle, width: 260, display: 'inline-block', marginRight: '0.5rem' }} />
                      <button onClick={() => saveTopic(ch.id)}>Add topic</button>
                      <button onClick={() => { setAddTopic(null); setNewTopicTitle(''); setNewTopicContent(''); }}>Cancel</button>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{ ...labelStyle, marginBottom: '0.25rem' }}>Content (optional, rich text)</span>
                      <RichTextEditor
                        value={newTopicContent}
                        onChange={setNewTopicContent}
                        placeholder="Type or paste content here. Use the toolbar for bold, lists, links, images, and tables."
                        minHeight="200px"
                      />
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddTopic(ch.id)} style={{ padding: '4px 10px', fontSize: '0.85rem', background: 'transparent', border: '1px dashed var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)' }}>+ Add topic</button>
                )}
              </div>
            )}
          </div>
        ))}
        {addChapter ? (
          <div style={{ marginBottom: '0.5rem' }}>
            <input value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} placeholder="Chapter title" style={{ ...inputStyle, width: 280, display: 'inline-block', marginRight: '0.5rem' }} />
            <button onClick={saveChapter}>Add chapter</button>
            <button onClick={() => { setAddChapter(false); setNewChapterTitle(''); }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddChapter(true)} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6 }}>+ Add chapter</button>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Assignments</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 0.75rem' }}>Assign this course to batches or individual students.</p>
        {assignments.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
            {assignments.map((a) => (
              <li key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 500 }}>
                  {a.batch ? (
                    <Link to={`/batches/${a.batch.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>Batch: {a.batch.name}</Link>
                  ) : a.user ? (
                    <span>Student: {a.user.name || a.user.email}</span>
                  ) : null}
                </span>
                {a.dueDate && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                )}
                <button onClick={() => removeAssignment(a.id)} style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: '0.75rem', background: 'transparent', border: '1px solid #ef444444', color: '#f87171', borderRadius: 4 }}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        {addAssignmentOpen ? (
          <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 6, border: '1px solid var(--color-border)' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>Assign to</label>
              <select value={assignType} onChange={(e) => { setAssignType(e.target.value as 'batch' | 'student'); setAssignBatchId(''); setAssignUserId(''); }} style={{ ...inputStyle, width: 120, display: 'inline-block', marginRight: '0.5rem' }}>
                <option value="batch">Batch</option>
                <option value="student">Student</option>
              </select>
            </div>
            {assignType === 'batch' ? (
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={labelStyle}>Batch</label>
                <select value={assignBatchId} onChange={(e) => setAssignBatchId(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
                  <option value="">Select a batch</option>
                  {batches.filter((b) => !assignments.some((a) => a.batch?.id === b.id)).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                  {batches.length > 0 && batches.every((b) => assignments.some((a) => a.batch?.id === b.id)) && (
                    <option value="" disabled>All batches already assigned</option>
                  )}
                </select>
              </div>
            ) : (
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={labelStyle}>Student</label>
                <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
                  <option value="">Select a student</option>
                  {students.filter((s) => !assignments.some((a) => a.user?.id === s.id)).map((s) => (
                    <option key={s.id} value={s.id}>{s.name || s.email}</option>
                  ))}
                  {students.length > 0 && students.every((s) => assignments.some((a) => a.user?.id === s.id)) && (
                    <option value="" disabled>All students already assigned</option>
                  )}
                </select>
              </div>
            )}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Due date (optional)</label>
              <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} style={{ ...inputStyle, width: 180 }} />
            </div>
            <div>
              <button onClick={addAssignment} style={{ padding: '4px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, marginRight: 8 }}>Assign</button>
              <button onClick={() => { setAddAssignmentOpen(false); setAssignBatchId(''); setAssignUserId(''); setAssignDueDate(''); }} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddAssignmentOpen(true)} style={{ padding: '4px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4 }}>+ Add assignment</button>
        )}
      </div>
    </div>
  );
}
