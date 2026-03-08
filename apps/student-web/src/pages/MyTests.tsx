import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface AllocatedTest {
  testId: string;
  assignedAt: string;
  attemptCount: number;
  courseContext: { courseName: string; topicName: string } | null;
  latestCompletedAttempt: {
    id: string;
    score: number | null;
    maxScore: number | null;
    submittedAt: string | null;
    percentage: number | null;
    passPercentage: number;
    result: 'pass' | 'fail';
  } | null;
  test: {
    id: string;
    title: string;
    type: string;
    status: string;
    config: { durationMinutes: number; attemptLimit: number; showResultsImmediately: boolean };
    schedule: { startAt: string; endAt: string } | null;
    _count: { testQuestions: number };
  };
}

function getTestGroup(test: AllocatedTest): 'active' | 'upcoming' | 'completed' {
  const now = Date.now();
  const schedule = test.test.schedule;
  if (test.attemptCount >= test.test.config.attemptLimit) return 'completed';
  if (test.latestCompletedAttempt) return 'completed';
  if (schedule) {
    const start = new Date(schedule.startAt).getTime();
    const end = new Date(schedule.endAt).getTime();
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
  }
  return 'active';
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: '10px',
  padding: '1.25rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
};

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0.2rem 0.6rem',
  borderRadius: '4px',
  background: `${color}20`,
  color,
});

export default function MyTests() {
  const [tests, setTests] = useState<AllocatedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<AllocatedTest[]>('/student/tests')
      .then(setTests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startTest = async (testId: string) => {
    setStarting(testId);
    try {
      const attempt = await api<{ id: string }>('/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ testId }),
      });
      navigate(`/attempt/${attempt.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start test');
    } finally {
      setStarting(null);
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading tests...</div>;

  const active = tests.filter((t) => getTestGroup(t) === 'active');
  const upcoming = tests.filter((t) => getTestGroup(t) === 'upcoming');
  const completed = tests.filter((t) => getTestGroup(t) === 'completed');

  const renderSection = (title: string, items: AllocatedTest[]) => {
    if (!items.length) return null;
    return (
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>{title}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((alloc) => {
            const group = getTestGroup(alloc);
            const canStart = group === 'active' && alloc.attemptCount < alloc.test.config.attemptLimit;
            const hasScheduleEnded = alloc.test.schedule
              ? Date.now() > new Date(alloc.test.schedule.endAt).getTime()
              : false;
            const canTakeAgain =
              group === 'completed' &&
              alloc.attemptCount < alloc.test.config.attemptLimit &&
              !hasScheduleEnded;
            const latest = alloc.latestCompletedAttempt;
            return (
              <div key={alloc.testId} style={cardStyle}>
                <div style={{ flex: 1 }}>
                  {alloc.courseContext && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                      {alloc.courseContext.courseName}
                      <span style={{ margin: '0 0.25rem' }}>›</span>
                      {alloc.courseContext.topicName}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>{alloc.test.title}</span>
                    <span style={badgeStyle(alloc.test.type === 'coding' ? '#6366f1' : '#22d3ee')}>
                      {alloc.test.type}
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {alloc.test.config.durationMinutes} min &middot;{' '}
                    {alloc.test._count.testQuestions} question{alloc.test._count.testQuestions !== 1 ? 's' : ''} &middot;{' '}
                    {alloc.attemptCount}/{alloc.test.config.attemptLimit} attempts used
                  </div>
                  {alloc.test.schedule && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {new Date(alloc.test.schedule.startAt).toLocaleDateString()} — {new Date(alloc.test.schedule.endAt).toLocaleDateString()}
                    </div>
                  )}
                  {latest && (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Score: {latest.score ?? 0}/{latest.maxScore ?? 0} &middot; Result:{' '}
                      <span style={{ color: latest.result === 'pass' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                        {latest.result.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                {canStart ? (
                  <button
                    onClick={() => startTest(alloc.test.id)}
                    disabled={!!starting}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {starting === alloc.test.id ? 'Starting...' : 'Start Test'}
                  </button>
                ) : canTakeAgain ? (
                  <button
                    onClick={() => startTest(alloc.test.id)}
                    disabled={!!starting}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {starting === alloc.test.id ? 'Starting...' : 'Take Again'}
                  </button>
                ) : group === 'completed' ? (
                  <Link
                    to={latest ? `/result/${latest.id}` : '/tests'}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text-muted)',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      flexShrink: 0,
                    }}
                  >
                    {latest ? 'View Result' : 'Completed'}
                  </Link>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', flexShrink: 0 }}>
                    Upcoming
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>My Tests</h1>
      {tests.length === 0 ? (
        <div style={{ ...cardStyle, justifyContent: 'center', color: 'var(--color-text-muted)' }}>
          No tests have been assigned to you yet.
        </div>
      ) : (
        <>
          {renderSection('Active', active)}
          {renderSection('Upcoming', upcoming)}
          {renderSection('Completed', completed)}
        </>
      )}
    </div>
  );
}
