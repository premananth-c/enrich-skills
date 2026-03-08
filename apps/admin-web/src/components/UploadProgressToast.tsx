import { useEffect, useState } from 'react';
import { subscribe, dismissTask, type UploadTask } from '../lib/uploadManager';

export default function UploadProgressToast() {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [minimized, setMinimized] = useState<Set<string>>(new Set());

  useEffect(() => subscribe(setTasks), []);

  const visible = tasks.filter((t) => !minimized.has(t.id) || t.status === 'uploading');
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 2100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
        width: '100%',
      }}
    >
      {visible.map((task) => (
        <div
          key={task.id}
          style={{
            background: 'var(--color-surface, #1e1e2e)',
            border: `1px solid ${task.status === 'failed' ? '#ef4444' : task.status === 'completed' ? '#22c55e' : 'var(--color-border, #333)'}`,
            borderRadius: 10,
            padding: '0.75rem 1rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            color: 'var(--color-text, #e0e0e0)',
            fontSize: '0.88rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
              {task.status === 'completed' ? 'Upload complete' : task.status === 'failed' ? 'Upload failed' : 'Uploading video'}
            </span>
            <button
              onClick={() => dismissTask(task.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted, #888)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 2px',
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>

          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.8rem',
              color: 'var(--color-text-muted, #888)',
              marginBottom: 6,
            }}
          >
            {task.filename}
          </div>

          {task.status === 'uploading' && (
            <>
              <div style={{ background: 'var(--color-border, #333)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${task.progress}%`,
                    height: '100%',
                    background: 'var(--color-primary, #6366f1)',
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #888)', marginTop: 4 }}>
                {task.progress}%
              </div>
            </>
          )}

          {task.status === 'completed' && (
            <div style={{ fontSize: '0.82rem', color: '#22c55e', fontWeight: 500 }}>
              Video uploaded successfully
            </div>
          )}

          {task.status === 'failed' && (
            <div style={{ fontSize: '0.82rem', color: '#ef4444' }}>
              {task.error || 'Upload failed'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
