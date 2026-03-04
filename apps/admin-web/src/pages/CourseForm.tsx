import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';

export default function CourseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [initialForm, setInitialForm] = useState({ title: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit && id) {
      api<{ title: string; description: string | null }>(`/courses/${id}`)
        .then((c) => {
          const next = { title: c.title, description: c.description ?? '' };
          setTitle(next.title);
          setDescription(next.description);
          setInitialForm(next);
        })
        .catch(() => navigate('/courses'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && id) {
        await api(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify({ title, description: description || undefined }) });
      } else {
        await api('/courses', { method: 'POST', body: JSON.stringify({ title, description: description || undefined }) });
      }
      navigate('/courses');
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };
  const isDirty = !isEdit || title !== initialForm.title || description !== initialForm.description;
  const canSubmit = !saving && title.trim().length > 0 && isDirty;

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem' }}>{isEdit ? 'Edit Course' : 'Create Course'}</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 500 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={!canSubmit} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canSubmit ? 1 : 0.65, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/courses')} style={{ padding: '0.5rem 1.25rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
