import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import {
  adminBtnCancelSm,
  adminBtnDestructiveTable,
  adminBtnPrimary,
  adminBtnPrimarySm,
} from '../lib/adminButtonStyles';
import RevisionHistoryModal from '../components/RevisionHistoryModal';

interface Course {
  id: string;
  title: string;
  description: string | null;
  isArchived?: boolean;
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; title: string } | null>(null);
  const navigate = useNavigate();

  const loadCourses = () => {
    setLoading(true);
    api<Course[]>('/courses?includeArchived=true')
      .then(setCourses)
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCourses(); }, []);

  const handleArchive = async (id: string, title: string) => {
    if (!confirm(`Archive course "${title}"?`)) return;
    try {
      await api(`/courses/${id}/archive`, { method: 'PATCH' });
      loadCourses();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Archive failed');
    }
  };

  const handleRevoke = async (id: string, title: string) => {
    if (!confirm(`Revoke archive for course "${title}"?`)) return;
    try {
      await api(`/courses/${id}/revoke`, { method: 'PATCH' });
      loadCourses();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Permanently delete course "${title}"? This cannot be undone.`)) return;
    try {
      await api(`/courses/${id}`, { method: 'DELETE' });
      loadCourses();
    } catch (e) {
      emitToast('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  const filtered = courses.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.title.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
  });
  const activeCourses = filtered.filter((c) => !c.isArchived);
  const archivedCourses = filtered.filter((c) => c.isArchived);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Courses</h1>
        <button type="button" onClick={() => navigate('/courses/new')} style={adminBtnPrimary}>
          + Create Course
        </button>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses by title or description"
          style={{ width: 380, padding: '0.6rem 0.85rem', background: '#fff', border: '2px solid #d1d5db', borderRadius: 8, color: '#111827', fontWeight: 600 }}
        />
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {activeCourses.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No courses yet. Create a course and add chapters, topics, materials, and evaluations.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeCourses.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/courses/${c.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{c.title}</Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => navigate(`/courses/${c.id}/edit`)} style={adminBtnPrimarySm}>Edit</button>
                      <button type="button" onClick={() => handleArchive(c.id, c.title)} style={adminBtnDestructiveTable}>Archive</button>
                      <button type="button" onClick={() => setHistoryTarget({ id: c.id, title: c.title })} style={adminBtnCancelSm}>Revision History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <h2 style={{ margin: '1.5rem 0 0.75rem', fontSize: '1.05rem' }}>Archived Courses</h2>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {archivedCourses.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No archived courses.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {archivedCourses.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{c.title}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => handleRevoke(c.id, c.title)} style={adminBtnPrimarySm}>Revoke</button>
                      <button type="button" onClick={() => handleDelete(c.id, c.title)} style={adminBtnDestructiveTable}>Delete</button>
                      <button type="button" onClick={() => setHistoryTarget({ id: c.id, title: c.title })} style={adminBtnCancelSm}>Revision History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {historyTarget && (
        <RevisionHistoryModal
          module="courses"
          entityId={historyTarget.id}
          entityLabel={historyTarget.title}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
