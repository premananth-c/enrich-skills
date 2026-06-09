import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import { SearchablePickerCombobox } from '../components/SearchablePickerCombobox';

interface ClientOption {
  id: string;
  name: string;
  isGeneral: boolean;
}

export default function BatchForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [initialForm, setInitialForm] = useState({ name: '', description: '', clientId: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    api<ClientOption[]>('/clients')
      .then((list) => {
        setClients(list);
        if (!isEdit) {
          const general = list.find((c) => c.isGeneral);
          if (general) setClientId(general.id);
        }
      })
      .catch(() => setClients([]));
  }, [isEdit]);

  useEffect(() => {
    if (isEdit && id) {
      api<{ name: string; description: string | null; clientId: string | null }>(`/batches/${id}`)
        .then((b) => {
          const next = { name: b.name, description: b.description ?? '', clientId: b.clientId ?? '' };
          setName(next.name);
          setDescription(next.description);
          setClientId(next.clientId);
          setInitialForm(next);
        })
        .catch(() => navigate('/batches'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name, description: description || undefined };
      if (clientId) payload.clientId = clientId;
      if (isEdit && id) {
        await api(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/batches', { method: 'POST', body: JSON.stringify(payload) });
      }
      navigate('/batches');
    } catch (err) {
      emitToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)', fontSize: '0.95rem' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 500 };
  const isDirty = !isEdit || name !== initialForm.name || description !== initialForm.description || clientId !== initialForm.clientId;
  const canSubmit = !saving && name.trim().length > 0 && isDirty;

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
          <label style={labelStyle}>Client</label>
          <SearchablePickerCombobox
            options={clients.map((c) => ({ id: c.id, label: c.name }))}
            value={clientId}
            onChange={setClientId}
            placeholder="Search clients..."
            emptyMessage={clients.length === 0 ? 'No clients' : 'No clients match'}
            maxWidth={400}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={!canSubmit} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500, opacity: canSubmit ? 1 : 0.65, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/batches')} style={{ padding: '0.5rem 1.25rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
