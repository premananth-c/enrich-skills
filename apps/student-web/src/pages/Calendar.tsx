import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type: string | null;
  batch: { name: string } | null;
  course: { title: string } | null;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const TYPE_COLORS: Record<string, string> = {
  class: '#6366f1',
  exam: '#ef4444',
  live_session: '#22d3ee',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const cellStyle: React.CSSProperties = {
  borderRight: '1px solid var(--color-border)',
  borderBottom: '1px solid var(--color-border)',
  padding: '0.5rem',
  verticalAlign: 'top',
  minHeight: 80,
};

export default function Calendar() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    api<CalendarEvent[]>(`/student/calendar?from=${from}&to=${to}`)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const weekDates = DAYS.map((_, i) => addDays(weekStart, i));

  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return events.filter((ev) => {
      const evStart = new Date(ev.startAt);
      return evStart >= dayStart && evStart <= dayEnd;
    });
  };

  const formatMonth = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Calendar</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setWeekStart((prev) => addDays(prev, -7))}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              fontSize: '0.9rem',
            }}
          >
            &larr; Prev
          </button>
          <span style={{ fontWeight: 500, minWidth: 180, textAlign: 'center' }}>
            {formatMonth(weekStart)}
          </span>
          <button
            onClick={() => setWeekStart((prev) => addDays(prev, 7))}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              fontSize: '0.9rem',
            }}
          >
            Next &rarr;
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
            }}
          >
            Today
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>Loading...</div>
      ) : (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {weekDates.map((d, i) => {
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <th
                      key={i}
                      style={{
                        ...cellStyle,
                        padding: '0.75rem 0.5rem',
                        textAlign: 'center',
                        fontWeight: 500,
                        fontSize: '0.85rem',
                        background: isToday ? 'rgba(99,102,241,0.1)' : 'transparent',
                      }}
                    >
                      <div>{DAYS[i]}</div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          marginTop: '0.15rem',
                          color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                        }}
                      >
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {weekDates.map((d, i) => {
                  const dayEvents = getEventsForDay(d);
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <td
                      key={i}
                      style={{
                        ...cellStyle,
                        background: isToday ? 'rgba(99,102,241,0.04)' : 'transparent',
                        height: 200,
                      }}
                    >
                      {dayEvents.length === 0 ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textAlign: 'center', paddingTop: '2rem' }}>
                          —
                        </div>
                      ) : (
                        dayEvents.map((ev) => {
                          const color = TYPE_COLORS[ev.type || ''] || 'var(--color-primary)';
                          return (
                            <div
                              key={ev.id}
                              style={{
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                                background: `${color}18`,
                                borderLeft: `3px solid ${color}`,
                                marginBottom: '0.35rem',
                                fontSize: '0.75rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, color, marginBottom: '0.1rem' }}>
                                {new Date(ev.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div style={{ color: 'var(--color-text)' }}>{ev.title}</div>
                              {ev.type && (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{ev.type}</div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Event type legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', justifyContent: 'center' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '2px', background: color }} />
            {type.replace('_', ' ')}
          </div>
        ))}
      </div>
    </div>
  );
}
