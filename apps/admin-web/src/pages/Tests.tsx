import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatStatusLabel } from '../lib/status';
import { emitToast } from '../lib/toast';
import RevisionHistoryModal from '../components/RevisionHistoryModal';
import CreateTestFromFileModal from '../components/CreateTestFromFileModal';

interface Test {
  id: string;
  title: string;
  type: string;
  status: string;
  config: { durationMinutes: number };
}

export default function Tests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; title: string } | null>(null);
  const [createFromFileOpen, setCreateFromFileOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteQuestions, setDeleteQuestions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const loadTests = () => {
    setLoading(true);
    api<Test[]>('/tests')
      .then(setTests)
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTests(); }, []);

  const handleArchive = async (id: string, title: string) => {
    if (!confirm(`Archive test "${title}"?`)) return;
    try {
      await api(`/tests/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
      loadTests();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Archive failed');
    }
  };

  const handleRevoke = async (id: string, title: string) => {
    if (!confirm(`Revoke archive for test "${title}"?`)) return;
    try {
      await api(`/tests/${id}/revoke`, { method: 'PATCH' });
      loadTests();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  const openDeleteModal = (id: string, title: string) => {
    setDeleteTarget({ id, title });
    setDeleteQuestions(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const qs = deleteQuestions ? '?deleteQuestions=true' : '';
      await api(`/tests/${deleteTarget.id}${qs}`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadTests();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const filtered = tests.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  });
  const activeTests = filtered.filter((t) => t.status !== 'archived');
  const archivedTests = filtered.filter((t) => t.status === 'archived');

  const renderRows = (items: Test[]) => (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
          <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
          <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Type</th>
          <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Status</th>
          <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Duration</th>
          <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <td style={{ padding: '0.75rem 1rem' }}>
              <Link to={`/tests/${t.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{t.title}</Link>
            </td>
            <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{t.type}</td>
            <td style={{ padding: '0.75rem 1rem' }}>
              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: t.status === 'published' ? '#16a34a22' : t.status === 'draft' ? '#eab30822' : '#71717a22', color: t.status === 'published' ? '#4ade80' : t.status === 'draft' ? '#fbbf24' : '#a1a1aa' }}>
                {formatStatusLabel(t.status)}
              </span>
            </td>
            <td style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)' }}>{t.config.durationMinutes} min</td>
            <td style={{ padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => navigate(`/tests/${t.id}`)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Edit</button>
                {t.status !== 'archived' && (
                  <button onClick={() => handleArchive(t.id, t.title)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Archive</button>
                )}
                {t.status === 'archived' && (
                  <>
                    <button onClick={() => handleRevoke(t.id, t.title)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #22c55e55', borderRadius: 4, color: '#4ade80', fontSize: '0.8rem' }}>Revoke</button>
                    <button onClick={() => openDeleteModal(t.id, t.title)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Delete</button>
                  </>
                )}
                <button onClick={() => setHistoryTarget({ id: t.id, title: t.title })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Revision History</button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Tests</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setCreateFromFileOpen(true)}
            style={{ padding: '0.5rem 1.25rem', background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 6, fontWeight: 500 }}
          >
            Create Test From File
          </button>
          <button
            onClick={() => navigate('/tests/new')}
            style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
          >
            + Create Test
          </button>
        </div>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tests by title, type, status"
          style={{ width: 380, padding: '0.6rem 0.85rem', background: '#fff', border: '2px solid #d1d5db', borderRadius: 8, color: '#111827', fontWeight: 600 }}
        />
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {activeTests.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No tests yet. Create your first test to get started.</div>
        ) : (
          renderRows(activeTests)
        )}
      </div>
      <h2 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.05rem' }}>Archived Tests</h2>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {archivedTests.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No archived tests.</div>
        ) : (
          renderRows(archivedTests)
        )}
      </div>
      {historyTarget && (
        <RevisionHistoryModal
          module="tests"
          entityId={historyTarget.id}
          entityLabel={historyTarget.title}
          onClose={() => setHistoryTarget(null)}
        />
      )}
      {createFromFileOpen && (
        <CreateTestFromFileModal
          onClose={() => setCreateFromFileOpen(false)}
          onCreated={loadTests}
        />
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '1.5rem', maxWidth: 440, width: '90%', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Delete Test</h3>
            <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Permanently delete <strong>{deleteTarget.title}</strong>? This cannot be undone.
            </p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', background: '#ef444410', border: '1px solid #ef444433', borderRadius: 8, cursor: 'pointer', marginBottom: '1.25rem' }}>
              <input
                type="checkbox"
                checked={deleteQuestions}
                onChange={(e) => setDeleteQuestions(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#ef4444' }}
              />
              <span style={{ fontSize: '0.88rem', color: '#f87171', lineHeight: 1.4 }}>
                Also permanently delete all questions that belong <em>only</em> to this test. Questions shared with other tests will be kept.
              </span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Deleting…' : deleteQuestions ? 'Delete Test & Questions' : 'Delete Test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
