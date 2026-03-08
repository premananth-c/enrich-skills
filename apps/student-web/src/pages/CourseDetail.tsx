import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import VideoPlayer from '../components/VideoPlayer';

interface Material {
  id: string;
  type: string;
  title: string;
  storageKey: string | null;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  order: number;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  order: number;
}

interface Evaluation {
  id: string;
  type: string;
  title: string;
  testId: string | null;
  test: { id: string; title: string; type: string; status: string } | null;
  order: number;
  testAttempts?: {
    attemptCount: number;
    latestAttempt: { id: string; score: number | null; maxScore: number | null; submittedAt: string | null } | null;
  } | null;
}

interface Topic {
  id: string;
  title: string;
  order: number;
  content: string | null;
  materials: Material[];
  activities: Activity[];
  evaluations: Evaluation[];
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  topics: Topic[];
}

interface CourseData {
  course: {
    id: string;
    title: string;
    description: string | null;
    chapters: Chapter[];
  };
  assignment: { dueDate: string | null; assignedAt: string };
  mySubmissions: Record<string, { id: string; fileName: string; submittedAt: string }>;
}

const sectionCard: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  overflow: 'hidden',
  marginBottom: '0.75rem',
};

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState<string | null>(null);
  const [startingTestId, setStartingTestId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    api<CourseData>(`/student/courses/${courseId}`)
      .then((res) => {
        setData(res);
        if (res.course.chapters.length > 0) {
          setOpenChapters(new Set([res.course.chapters[0].id]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  const toggleChapter = (id: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startTestFromCourse = async (testId: string) => {
    if (!courseId) return;
    setStartingTestId(testId);
    try {
      const attempt = await api<{ id: string }>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ testId }),
      });
      navigate(`/attempt/${attempt.id}`, { state: { fromCourse: courseId } });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start test');
    } finally {
      setStartingTestId(null);
    }
  };

  const handleUpload = async (activityId: string, file: File) => {
    setUploading(activityId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('enrich_access_token');
      const tenantId = localStorage.getItem('enrich_tenant_id');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['X-Tenant-Id'] = tenantId;

      const res = await fetch(`/api/v1/student/activities/${activityId}/submit`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const sub = await res.json();

      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          mySubmissions: {
            ...prev.mySubmissions,
            [activityId]: sub,
          },
        };
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading course...</div>;
  if (!data) return <div style={{ padding: '2rem', color: '#ef4444' }}>Course not found.</div>;

  const { course, assignment, mySubmissions } = data;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Link to="/courses" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
        &larr; Back to Courses
      </Link>

      <h1 style={{ margin: '0.75rem 0 0.25rem', fontSize: '1.5rem' }}>{course.title}</h1>
      {course.description && (
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{course.description}</p>
      )}
      {assignment.dueDate && (
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          Due: {new Date(assignment.dueDate).toLocaleDateString()}
        </p>
      )}

      {course.chapters.length === 0 ? (
        <div style={{ ...sectionCard, padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No content has been added to this course yet.
        </div>
      ) : (
        course.chapters
          .sort((a, b) => a.order - b.order)
          .map((chapter) => {
            const isOpen = openChapters.has(chapter.id);
            return (
              <div key={chapter.id} style={sectionCard}>
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  style={{
                    width: '100%',
                    padding: '1rem 1.25rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text)',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{chapter.title}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {isOpen ? '▾' : '▸'} {chapter.topics.length} topic{chapter.topics.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 1.25rem 1rem' }}>
                    {chapter.topics
                      .sort((a, b) => a.order - b.order)
                      .map((topic) => (
                        <div
                          key={topic.id}
                          style={{
                            marginBottom: '1rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{topic.title}</h4>
                          {topic.content && (
                            <div
                              style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem', lineHeight: 1.6 }}
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(topic.content) }}
                            />
                          )}

                          {/* Materials */}
                          {topic.materials.length > 0 && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              {topic.materials
                                .sort((a, b) => a.order - b.order)
                                .map((mat) =>
                                  mat.type === 'video' ? (
                                    <div key={mat.id} style={{ marginBottom: '0.75rem' }}>
                                      <VideoPlayer materialId={mat.id} title={mat.title} />
                                    </div>
                                  ) : mat.type === 'pdf' && mat.storageKey ? (
                                    <Link
                                      key={mat.id}
                                      to={`/pdf/${mat.id}?title=${encodeURIComponent(mat.title)}&back=${encodeURIComponent(`/courses/${courseId}`)}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        marginRight: '0.75rem',
                                        marginBottom: '0.35rem',
                                        padding: '0.35rem 0.75rem',
                                        background: 'var(--color-bg)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        color: 'var(--color-primary)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      📄 {mat.title}
                                    </Link>
                                  ) : (
                                    <a
                                      key={mat.id}
                                      href={mat.url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        marginRight: '0.75rem',
                                        marginBottom: '0.35rem',
                                        padding: '0.35rem 0.75rem',
                                        background: 'var(--color-bg)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        color: 'var(--color-primary)',
                                        textDecoration: 'none',
                                      }}
                                    >
                                      🔗 {mat.title}
                                    </a>
                                  )
                                )}
                            </div>
                          )}

                          {/* Activities (assignments) */}
                          {topic.activities
                            .sort((a, b) => a.order - b.order)
                            .map((act) => {
                              const sub = mySubmissions[act.id];
                              return (
                                <div
                                  key={act.id}
                                  style={{
                                    padding: '0.75rem',
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '8px',
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{act.title}</div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                                      {act.type}
                                    </div>
                                    {sub && (
                                      <div style={{ color: '#22c55e', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                        Submitted: {sub.fileName} ({new Date(sub.submittedAt).toLocaleDateString()})
                                      </div>
                                    )}
                                  </div>
                                  <label
                                    style={{
                                      padding: '0.4rem 0.75rem',
                                      background: sub ? 'var(--color-surface)' : 'var(--color-primary)',
                                      color: sub ? 'var(--color-text-muted)' : 'white',
                                      border: sub ? '1px solid var(--color-border)' : 'none',
                                      borderRadius: '6px',
                                      fontSize: '0.8rem',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {uploading === act.id ? 'Uploading...' : sub ? 'Re-upload' : 'Upload'}
                                    <input
                                      type="file"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleUpload(act.id, file);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              );
                            })}

                          {/* Evaluations (linked tests) */}
                          {topic.evaluations
                            .sort((a, b) => a.order - b.order)
                            .map((ev) => {
                              const attempts = ev.testAttempts;
                              const hasAttempts = attempts && attempts.attemptCount > 0;
                              const latest = attempts?.latestAttempt;
                              return (
                                <div
                                  key={ev.id}
                                  style={{
                                    padding: '0.75rem',
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '8px',
                                    marginBottom: '0.5rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{ev.title}</div>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{ev.type}</div>
                                    {hasAttempts && (
                                      <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {attempts!.attemptCount} attempt{attempts!.attemptCount !== 1 ? 's' : ''}
                                        {latest && (latest.score != null && latest.maxScore != null)
                                          ? ` • Latest score: ${latest.score} / ${latest.maxScore}`
                                          : latest?.submittedAt
                                            ? ' • Submitted'
                                            : ''}
                                      </div>
                                    )}
                                  </div>
                                  {ev.test && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                      {hasAttempts && latest && (
                                        <Link
                                          to={`/result/${latest.id}`}
                                          style={{
                                            padding: '0.4rem 0.75rem',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            color: 'var(--color-text)',
                                            textDecoration: 'none',
                                          }}
                                        >
                                          View result
                                        </Link>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => startTestFromCourse(ev.test!.id)}
                                        disabled={!!startingTestId}
                                        style={{
                                          padding: '0.4rem 0.75rem',
                                          background: 'var(--color-primary)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          fontSize: '0.8rem',
                                          fontWeight: 500,
                                          cursor: startingTestId ? 'wait' : 'pointer',
                                          opacity: startingTestId ? 0.8 : 1,
                                        }}
                                      >
                                        {startingTestId === ev.test.id ? 'Starting…' : 'Take Test'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })
      )}
    </div>
  );
}
