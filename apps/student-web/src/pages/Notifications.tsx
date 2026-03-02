import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  test_allocated: '✎',
  course_assigned: '📖',
  result_ready: '📊',
  announcement: '📢',
  assignment_due: '📋',
};

function groupByDate(items: NotificationItem[]): [string, NotificationItem[]][] {
  const groups = new Map<string, NotificationItem[]>();
  items.forEach((item) => {
    const date = new Date(item.createdAt).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const existing = groups.get(date) || [];
    existing.push(item);
    groups.set(date, existing);
  });
  return [...groups.entries()];
}

function getNavigationPath(notification: NotificationItem): string | null {
  const { type, metadata } = notification;
  if (type === 'test_allocated' && metadata.testId) return '/tests';
  if (type === 'course_assigned' && metadata.courseId) return `/courses/${metadata.courseId}`;
  if (type === 'result_ready' && metadata.attemptId) return `/result/${metadata.attemptId}`;
  return null;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api<NotificationItem[]>('/student/notifications')
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAsRead = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await api(`/student/notifications/${notification.id}/read`, { method: 'PATCH' }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }

    const path = getNavigationPath(notification);
    if (path) navigate(path);
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(
      unread.map((n) => api(`/student/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {}))
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading notifications...</div>;

  const grouped = groupByDate(notifications);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-primary)',
              fontSize: '0.85rem',
            }}
          >
            Mark all read ({unreadCount})
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '10px',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}
        >
          No notifications yet.
        </div>
      ) : (
        grouped.map(([date, items]) => (
          <div key={date} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
              {date}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {items.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => markAsRead(notif)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    background: notif.isRead ? 'var(--color-surface)' : 'rgba(99,102,241,0.06)',
                    border: `1px solid ${notif.isRead ? 'var(--color-border)' : 'rgba(99,102,241,0.2)'}`,
                    borderRadius: '8px',
                    textAlign: 'left',
                    width: '100%',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.2rem', lineHeight: 1, marginTop: '0.1rem' }}>
                    {TYPE_ICONS[notif.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: notif.isRead ? 400 : 600, fontSize: '0.9rem' }}>{notif.title}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                        {new Date(notif.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      {notif.message}
                    </div>
                  </div>
                  {!notif.isRead && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        flexShrink: 0,
                        marginTop: '0.4rem',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
