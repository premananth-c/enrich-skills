import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Course {
  id: string;
  title: string;
  description: string | null;
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadCourses = () => {
    setLoading(true);
    api<Course[]>('/courses')
      .then(setCourses)
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCourses(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete course "${title}"? This cannot be undone.`)) return;
    try {
      await api(`/courses/${id}`, { method: 'DELETE' });
      loadCourses();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Courses</h1>
        <button
          onClick={() => navigate('/courses/new')}
          style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}
        >
          + Create Course
        </button>
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {courses.length === 0 ? (
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
              {courses.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link to={`/courses/${c.id}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>{c.title}</Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => navigate(`/courses/${c.id}/edit`)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Edit</button>
                      <button onClick={() => handleDelete(c.id, c.title)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #ef444444', borderRadius: 4, color: '#f87171', fontSize: '0.8rem' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
