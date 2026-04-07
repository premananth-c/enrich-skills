import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { adminBtnPrimary, adminBtnCancel } from '../lib/adminButtonStyles';

interface Batch {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.95rem' };
const selectStyle: React.CSSProperties = { ...inputStyle };
const sectionStyle: React.CSSProperties = { marginBottom: '1.25rem' };

export default function MeetingForm() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<'interactive_meeting' | 'webinar'>('interactive_meeting');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [batchId, setBatchId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [coHostUserIds, setCoHostUserIds] = useState<string[]>([]);

  // Interactive meeting config
  const [participantVideoDefaultOn, setParticipantVideoDefaultOn] = useState(true);
  const [participantAudioDefaultOn, setParticipantAudioDefaultOn] = useState(true);
  const [allowParticipantScreenShare, setAllowParticipantScreenShare] = useState(false);
  const [chatMode, setChatMode] = useState<'admin_only' | 'everyone'>('everyone');

  // Webinar config
  const [webinarChatMode, setWebinarChatMode] = useState<'admin_only' | 'everyone' | 'off'>('everyone');

  useEffect(() => {
    api<Batch[]>('/batches').then(setBatches).catch(() => {});
    api<AdminUser[]>('/users').then((users) => setAdmins(users.filter((u) => u.role === 'admin' || u.role === 'super_admin'))).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const config = type === 'webinar'
        ? { chatMode: webinarChatMode }
        : { participantVideoDefaultOn, participantAudioDefaultOn, allowParticipantScreenShare, chatMode };

      const body: Record<string, unknown> = {
        name: name.trim(),
        type,
        maxParticipants,
        config,
        coHostUserIds,
      };
      if (batchId) body.batchId = batchId;
      if (scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();

      const meeting = await api<{ id: string }>('/meetings', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      navigate(`/meetings/${meeting.id}`);
    } catch {
      // error toast handled by api()
    } finally {
      setSaving(false);
    }
  };

  const isValid = name.trim().length > 0 && maxParticipants >= 2;

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Create Meeting</h1>
      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <label style={labelStyle}>Meeting Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="e.g. Weekly Live Class" />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Type *</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'interactive_meeting' | 'webinar')} style={selectStyle}>
            <option value="interactive_meeting">Interactive Meeting</option>
            <option value="webinar">Webinar</option>
          </select>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Number of Participants *</label>
          <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} min={2} max={10000} required style={inputStyle} />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Batch (optional)</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={selectStyle}>
            <option value="">— None —</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Scheduled At (optional)</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={inputStyle} />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Co-Hosts (optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {admins.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={coHostUserIds.includes(a.id)}
                  onChange={(e) => {
                    setCoHostUserIds(e.target.checked ? [...coHostUserIds, a.id] : coHostUserIds.filter((id) => id !== a.id));
                  }}
                />
                {a.name} {a.email ? `(${a.email})` : ''}
              </label>
            ))}
            {admins.length === 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No admin users found.</span>}
          </div>
        </div>

        {type === 'interactive_meeting' && (
          <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
            <legend style={{ fontSize: '0.9rem', fontWeight: 600, padding: '0 0.5rem' }}>Meeting Configuration</legend>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={participantVideoDefaultOn} onChange={(e) => setParticipantVideoDefaultOn(e.target.checked)} />
              Participant Video On by Default
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={participantAudioDefaultOn} onChange={(e) => setParticipantAudioDefaultOn(e.target.checked)} />
              Participant Audio On by Default (uncheck to Mute All)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={allowParticipantScreenShare} onChange={(e) => setAllowParticipantScreenShare(e.target.checked)} />
              Allow Participant Screen Sharing
            </label>

            <div>
              <label style={labelStyle}>Chat Mode</label>
              <select value={chatMode} onChange={(e) => setChatMode(e.target.value as 'admin_only' | 'everyone')} style={selectStyle}>
                <option value="everyone">Chat to Everyone</option>
                <option value="admin_only">Chat Only to Admin</option>
              </select>
            </div>
          </fieldset>
        )}

        {type === 'webinar' && (
          <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
            <legend style={{ fontSize: '0.9rem', fontWeight: 600, padding: '0 0.5rem' }}>Webinar Configuration</legend>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Participants cannot turn on video or audio. Only Host and Co-Hosts can broadcast.
            </p>
            <div>
              <label style={labelStyle}>Chat Mode</label>
              <select value={webinarChatMode} onChange={(e) => setWebinarChatMode(e.target.value as 'admin_only' | 'everyone' | 'off')} style={selectStyle}>
                <option value="everyone">Chat to Everyone</option>
                <option value="admin_only">Chat with Admin Only</option>
                <option value="off">No Chat</option>
              </select>
            </div>
          </fieldset>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" disabled={!isValid || saving} style={{ ...adminBtnPrimary, opacity: !isValid || saving ? 0.65 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Creating...' : 'Create Meeting'}
          </button>
          <button type="button" onClick={() => navigate('/meetings')} style={adminBtnCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
