import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface RevisionLogEntry {
  id: string;
  module: string;
  action: string;
  userName?: string | null;
  createdAt: string;
}

interface Props {
  module: 'tests' | 'students' | 'courses' | 'questions' | 'batches';
  entityId: string;
  entityLabel: string;
  onClose: () => void;
}

export default function RevisionHistoryModal({ module, entityId, entityLabel, onClose }: Props) {
  const [logs, setLogs] = useState<RevisionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<RevisionLogEntry[]>(`/revisions?module=${module}&entityId=${entityId}`)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [module, entityId]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ width: 640, maxHeight: '75vh', overflow: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Revision History</h3>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>{entityLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>x</button>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          {loading ? (
            <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : logs.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)' }}>No revisions found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Action</th>
                  <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>User</th>
                  <th style={{ padding: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{log.action}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>{log.userName || 'System'}</td>
                    <td style={{ padding: '0.5rem', color: 'var(--color-text-muted)' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
