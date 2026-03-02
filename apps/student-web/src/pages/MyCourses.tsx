import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface CourseItem {
  id: string;
  courseId: string;
  batchId: string | null;
  batchName: string | null;
  dueDate: string | null;
  assignedAt: string;
  course: { id: string; title: string; description: string | null };
  totalActivities: number;
  completedActivities: number;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

export default function MyCourses() {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<CourseItem[]>('/student/courses')
      .then(setCourses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading courses...</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem' }}>My Courses</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Courses assigned to you or your batch.
      </p>

      {courses.length === 0 ? (
        <div
          style={{
            ...cardStyle,
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--color-text-muted)',
          }}
        >
          No courses have been assigned to you yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {courses.map((item) => {
            const progress = item.totalActivities > 0
              ? Math.round((item.completedActivities / item.totalActivities) * 100)
              : 0;

            return (
              <Link
                key={item.id}
                to={`/courses/${item.courseId}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={cardStyle}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{item.course.title}</h3>
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--color-text-muted)',
                      fontSize: '0.85rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.course.description || 'No description'}
                  </p>

                  {item.batchName && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-accent)' }}>
                      Batch: {item.batchName}
                    </div>
                  )}

                  {item.dueDate && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Due: {new Date(item.dueDate).toLocaleDateString()}
                    </div>
                  )}

                  {/* Progress bar */}
                  <div style={{ marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                      <span>Progress</span>
                      <span>{item.completedActivities}/{item.totalActivities} activities</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          background: progress === 100 ? '#22c55e' : 'var(--color-primary)',
                          borderRadius: '3px',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
