import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import { useSidebar } from '../context/SidebarContext';
import VideoThumbnail from '../components/VideoThumbnail';

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

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const topicFromUrl = searchParams.get('topic');
  const { setCustomSidebar } = useSidebar();
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [startingTestId, setStartingTestId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    api<CourseData>(`/student/courses/${courseId}`)
      .then((res) => {
        setData(res);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!data) return;
    const chapters = [...data.course.chapters].sort((a, b) => a.order - b.order);
    if (chapters.length === 0) return;

    if (topicFromUrl) {
      for (const ch of chapters) {
        const topicIds = ch.topics.map((t) => t.id);
        if (topicIds.includes(topicFromUrl)) {
          setSelectedTopicId(topicFromUrl);
          setOpenChapters((prev) => new Set([...prev, ch.id]));
          return;
        }
      }
    }

    const firstChapter = chapters[0];
    setOpenChapters(new Set([firstChapter.id]));
    const sortedTopics = [...firstChapter.topics].sort((a, b) => a.order - b.order);
    if (sortedTopics.length > 0) {
      setSelectedTopicId(sortedTopics[0].id);
    }
  }, [data, topicFromUrl]);

  // Clear custom sidebar when unmounting
  useEffect(() => {
    return () => setCustomSidebar(null);
  }, [setCustomSidebar]);

  const toggleChapter = useCallback((id: string) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleTopicClick = useCallback((topicId: string, chapterId: string) => {
    setSelectedTopicId(topicId);
    setOpenChapters((prev) => {
      if (prev.has(chapterId)) return prev;
      return new Set([...prev, chapterId]);
    });
  }, []);

  // Update sidebar whenever relevant state changes
  useEffect(() => {
    if (!data) {
      setCustomSidebar(null);
      return;
    }

    const { course, assignment } = data;

    setCustomSidebar(
      <div>
        <Link to="/courses" style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.75rem' }}>
          &larr; Back to Courses
        </Link>

        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1rem', lineHeight: 1.3 }}>{course.title}</h2>
        {assignment.dueDate && (
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 1rem' }}>
            Due: {new Date(assignment.dueDate).toLocaleDateString()}
          </p>
        )}

        {course.chapters.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No content yet.</p>
        ) : (
          <nav>
            {course.chapters
              .sort((a, b) => a.order - b.order)
              .map((chapter) => {
                const isOpen = openChapters.has(chapter.id);
                return (
                  <div key={chapter.id} style={{ marginBottom: '0.5rem' }}>
                    <button
                      onClick={() => toggleChapter(chapter.id)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.5rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text)',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                        {isOpen ? '▼' : '▶'}
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chapter.title}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ marginLeft: '1rem', borderLeft: '2px solid var(--color-border)', paddingLeft: '0.5rem' }}>
                        {chapter.topics
                          .sort((a, b) => a.order - b.order)
                          .map((topic) => {
                            const isSelected = topic.id === selectedTopicId;
                            return (
                              <button
                                key={topic.id}
                                onClick={() => handleTopicClick(topic.id, chapter.id)}
                                style={{
                                  width: '100%',
                                  padding: '0.4rem 0.5rem',
                                  background: isSelected ? 'var(--color-primary)' : 'transparent',
                                  border: 'none',
                                  color: isSelected ? 'white' : 'var(--color-text-muted)',
                                  textAlign: 'left',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginBottom: '0.15rem',
                                }}
                              >
                                {topic.title}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </nav>
        )}
      </div>
    );
  }, [data, openChapters, selectedTopicId, setCustomSidebar, toggleChapter, handleTopicClick]);

  const startTestFromCourse = async (testId: string) => {
    if (!courseId) return;
    setStartingTestId(testId);
    try {
      const attempt = await api<{ id: string }>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ testId }),
      });
      navigate(`/attempt/${attempt.id}`, {
        state: { fromCourse: courseId, fromTopic: selectedTopicId ?? undefined },
      });
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

  const { course, mySubmissions } = data;

  const allTopics = course.chapters.flatMap((ch) => ch.topics);
  const selectedTopic = allTopics.find((t) => t.id === selectedTopicId);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {!selectedTopic ? (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}
        >
          {course.chapters.length === 0 ? 'No content has been added to this course yet.' : 'Select a topic from the sidebar to view its content.'}
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '1.5rem',
          }}
        >
          <h1 style={{ margin: '0 0 1rem', fontSize: '1.4rem' }}>{selectedTopic.title}</h1>

          {selectedTopic.content && (
            <div
              style={{ color: 'var(--color-text)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedTopic.content) }}
            />
          )}

          {/* Video Materials as Thumbnails */}
          {selectedTopic.materials.filter((m) => m.type === 'video').length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>Videos</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                {selectedTopic.materials
                  .filter((m) => m.type === 'video')
                  .sort((a, b) => a.order - b.order)
                  .map((mat) => (
                    <VideoThumbnail key={mat.id} materialId={mat.id} title={mat.title} />
                  ))}
              </div>
            </div>
          )}

          {/* Other Materials (PDFs, links) */}
          {selectedTopic.materials.filter((m) => m.type !== 'video').length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>Materials</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {selectedTopic.materials
                  .filter((m) => m.type !== 'video')
                  .sort((a, b) => a.order - b.order)
                  .map((mat) =>
                    mat.type === 'pdf' && mat.storageKey ? (
                      <Link
                        key={mat.id}
                        to={`/pdf/${mat.id}?title=${encodeURIComponent(mat.title)}&back=${encodeURIComponent(`/courses/${courseId}`)}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.5rem 0.85rem',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
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
                          padding: '0.5rem 0.85rem',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          color: 'var(--color-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        🔗 {mat.title}
                      </a>
                    )
                  )}
              </div>
            </div>
          )}

          {/* Activities (assignments) */}
          {selectedTopic.activities.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>Assignments</h3>
              {selectedTopic.activities
                .sort((a, b) => a.order - b.order)
                .map((act) => {
                  const sub = mySubmissions[act.id];
                  return (
                    <div
                      key={act.id}
                      style={{
                        padding: '0.85rem 1rem',
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
                        <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{act.title}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{act.type}</div>
                        {sub && (
                          <div style={{ color: '#22c55e', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            Submitted: {sub.fileName} ({new Date(sub.submittedAt).toLocaleDateString()})
                          </div>
                        )}
                      </div>
                      <label
                        style={{
                          padding: '0.5rem 0.85rem',
                          background: sub ? 'var(--color-surface)' : 'var(--color-primary)',
                          color: sub ? 'var(--color-text-muted)' : 'white',
                          border: sub ? '1px solid var(--color-border)' : 'none',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
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
            </div>
          )}

          {/* Evaluations (linked tests) */}
          {selectedTopic.evaluations.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>Tests & Quizzes</h3>
              {selectedTopic.evaluations
                .sort((a, b) => a.order - b.order)
                .map((ev) => {
                  const attempts = ev.testAttempts;
                  const hasAttempts = attempts && attempts.attemptCount > 0;
                  const latest = attempts?.latestAttempt;
                  return (
                    <div
                      key={ev.id}
                      style={{
                        padding: '0.85rem 1rem',
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
                        <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{ev.title}</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{ev.type}</div>
                        {hasAttempts && (
                          <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            {attempts!.attemptCount} attempt{attempts!.attemptCount !== 1 ? 's' : ''}
                            {latest && latest.score != null && latest.maxScore != null
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
                                padding: '0.5rem 0.85rem',
                                border: '1px solid var(--color-border)',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
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
                              padding: '0.5rem 0.85rem',
                              background: 'var(--color-primary)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
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
          )}
        </div>
      )}
    </div>
  );
}
