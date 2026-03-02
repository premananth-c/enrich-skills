import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function BatchForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit && id) {
      api<{ name: string; description: string | null }>(`/batches/${id}`)
        .then((b) => { setName(b.name); setDescription(b.description ?? ''); })
        .catch(() => navigate('/batches'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && id) {
        await api(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify({ name, description: description || undefined }) });
      } else {
        await api('/batches', { method: 'POST', body: JSON.stringify({ name, description: description || undefined }) });
      }
      navigate('/batches');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem' }}>{isEdit ? 'Edit Batch' : 'Create Batch'}</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500 }}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/batches')} style={{ padding: '0.5rem 1.25rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
