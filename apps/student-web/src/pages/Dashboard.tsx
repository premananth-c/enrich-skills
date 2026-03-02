import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface DashboardData {
  allocatedTests: {
    testId: string;
    test: { id: string; title: string; type: string; config: { durationMinutes: number; attemptLimit: number }; schedule: { startAt: string; endAt: string } | null };
  }[];
  courseAssignments: {
    courseId: string;
    course: { id: string; title: string; description: string | null };
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    type: string | null;
  }[];
  unreadCount: number;
  recentAttempts: {
    id: string;
    testId: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    test: { title: string; config: { showResultsImmediately?: boolean } };
  }[];
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  padding: '1.25rem',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api<DashboardData>('/student/dashboard').then(setData).catch(() => {});
  }, []);

  if (!data) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>;

  const startTest = async (testId: string) => {
    try {
      const attempt = await api<{ id: string }>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ testId }),
      });
      navigate(`/attempt/${attempt.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start test');
    }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem' }}>Welcome, {user?.name}</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Here's an overview of your learning activity.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2rem' }}>✎</span>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.allocatedTests.length}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Tests Assigned</div>
          </div>
        </div>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2rem' }}>📖</span>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.courseAssignments.length}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Courses Assigned</div>
          </div>
        </div>
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2rem' }}>🔔</span>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.unreadCount}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Unread Notifications</div>
          </div>
        </div>
      </div>

      {data.allocatedTests.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Active & Upcoming Tests</h2>
            <Link to="/tests" style={{ fontSize: '0.85rem' }}>View all</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.allocatedTests.slice(0, 5).map((alloc) => (
              <div key={alloc.testId} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{alloc.test.title}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {alloc.test.type} &middot; {alloc.test.config.durationMinutes} min
                  </div>
                </div>
                <button
                  onClick={() => startTest(alloc.test.id)}
                  style={{
                    padding: '0.45rem 1rem',
                    background: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.courseAssignments.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>My Courses</h2>
            <Link to="/courses" style={{ fontSize: '0.85rem' }}>View all</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {data.courseAssignments.slice(0, 3).map((ca) => (
              <Link key={ca.courseId} to={`/courses/${ca.courseId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ ...cardStyle }}>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{ca.course.title}</h3>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {ca.course.description || 'No description'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data.upcomingEvents.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>This Week</h2>
            <Link to="/calendar" style={{ fontSize: '0.85rem' }}>View calendar</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.upcomingEvents.map((ev) => (
              <div key={ev.id} style={{ ...cardStyle, padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{ev.title}</span>
                  {ev.type && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        background: ev.type === 'exam' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                        color: ev.type === 'exam' ? '#ef4444' : 'var(--color-primary)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {ev.type}
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {new Date(ev.startAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(ev.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.recentAttempts.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Recent Attempts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.recentAttempts.map((a) => (
              <Link
                key={a.id}
                to={a.status !== 'in_progress' ? `/result/${a.id}` : `/attempt/${a.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ ...cardStyle, padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{a.test.title}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {a.status === 'in_progress'
                      ? 'In Progress'
                      : a.score != null && a.maxScore != null
                        ? `${a.score}/${a.maxScore}`
                        : a.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
