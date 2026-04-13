import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import { adminBtnPrimary, adminBtnPrimarySm, adminBtnCancel, adminBtnDestructiveTable } from '../lib/adminButtonStyles';

interface Recording {
  id: string;
  providerRecordingId: string | null;
  storageKey: string | null;
  playbackUrl: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

interface Meeting {
  id: string;
  name: string;
  type: 'interactive_meeting' | 'webinar';
  maxParticipants: number;
  status: 'scheduled' | 'live' | 'ended';
  provider: string;
  providerRoomUrl: string | null;
  config: Record<string, unknown>;
  hostUserId: string;
  coHostUserIds: string[];
  scheduledAt: string | null;
  endedAt: string | null;
  createdAt: string;
  host?: { id: string; name: string; email: string | null };
  batch?: { id: string; name: string } | null;
  recordings?: Recording[];
}

const statusColors: Record<string, string> = { scheduled: '#2563eb', live: '#16a34a', ended: '#6b7280' };

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);

  const loadMeeting = () => {
    if (!id) return;
    setLoading(true);
    api<Meeting>(`/meetings/${id}`)
      .then(setMeeting)
      .catch(() => setMeeting(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMeeting(); }, [id]);

  useEffect(() => {
    if (!id) return;
    api<{ link: string }>(`/meetings/${id}/share-link`)
      .then((d) => setShareLink(d.link))
      .catch(() => {});
  }, [id]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      emitToast('error', 'Failed to copy');
    }
  };

  const handleSendInvites = async () => {
    if (!id) return;
    const emails = inviteEmails
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    setSending(true);
    try {
      const result = await api<{ sent: number; failed: number }>(`/meetings/${id}/send-invite`, {
        method: 'POST',
        body: JSON.stringify({ emails }),
      });
      emitToast('success', `Sent ${result.sent} invite(s)${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
      setInviteEmails('');
    } catch {
      // handled by api()
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: 'live' | 'ended') => {
    if (!id) return;
    try {
      await api(`/meetings/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      loadMeeting();
    } catch {
      // handled by api()
    }
  };

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      const data = await api<{ token: string; roomUrl: string }>(`/meetings/${id}/join-token`, { method: 'POST' });
      window.open(`${data.roomUrl}?t=${data.token}`, '_blank');
    } catch {
      // handled by api()
    } finally {
      setJoining(false);
    }
  };

  const hasActiveRecording = meeting?.recordings?.some((r) => !r.storageKey && !r.playbackUrl) ?? false;

  const handleStartRecording = async () => {
    if (!id) return;
    setRecordingLoading(true);
    try {
      await api(`/meetings/${id}/recording/start`, { method: 'POST' });
      setRecording(true);
      loadMeeting();
    } catch {
      // handled by api()
    } finally {
      setRecordingLoading(false);
    }
  };

  const handleStopRecording = async () => {
    if (!id) return;
    setRecordingLoading(true);
    try {
      await api(`/meetings/${id}/recording/stop`, { method: 'POST' });
      setRecording(false);
      loadMeeting();
    } catch {
      // handled by api()
    } finally {
      setRecordingLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!meeting || !confirm(`Delete meeting "${meeting.name}"?`)) return;
    try {
      await api(`/meetings/${id}`, { method: 'DELETE' });
      navigate('/meetings');
    } catch {
      // handled by api()
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>;
  if (!meeting) return <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Meeting not found.</div>;

  const typeLabel = meeting.type === 'webinar' ? 'Webinar' : 'Interactive Meeting';

  return (
    <div style={{ maxWidth: 720 }}>
      <button type="button" onClick={() => navigate('/meetings')} style={{ ...adminBtnCancel, marginBottom: '1rem', fontSize: '0.85rem' }}>&larr; Back to Meetings</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{meeting.name}</h1>
        <span style={{ padding: '3px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500, background: `${statusColors[meeting.status]}18`, color: statusColors[meeting.status] }}>
          {meeting.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 2rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Type:</span> {typeLabel}</div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Max Participants:</span> {meeting.maxParticipants}</div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Host:</span> {meeting.host?.name ?? '—'}</div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Batch:</span> {meeting.batch?.name ?? '—'}</div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Scheduled:</span> {meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString() : '—'}</div>
        <div><span style={{ color: 'var(--color-text-muted)' }}>Created:</span> {new Date(meeting.createdAt).toLocaleString()}</div>
      </div>

      {/* Config summary */}
      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Configuration</h3>
        {meeting.type === 'interactive_meeting' ? (
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>Participant Video: <strong>{(meeting.config as { participantVideoDefaultOn?: boolean }).participantVideoDefaultOn !== false ? 'On' : 'Off'}</strong> by default</div>
            <div>Participant Audio: <strong>{(meeting.config as { participantAudioDefaultOn?: boolean }).participantAudioDefaultOn !== false ? 'On' : 'Off'}</strong> by default</div>
            <div>Screen Sharing: <strong>{(meeting.config as { allowParticipantScreenShare?: boolean }).allowParticipantScreenShare ? 'Allowed' : 'Host/Co-Host only'}</strong></div>
            <div>Chat: <strong>{(meeting.config as { chatMode?: string }).chatMode === 'admin_only' ? 'Admin only' : 'Everyone'}</strong></div>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>Participant Video & Audio: <strong>Off</strong> (host/co-host only)</div>
            <div>Chat: <strong>{
              (meeting.config as { chatMode?: string }).chatMode === 'off' ? 'Disabled' :
              (meeting.config as { chatMode?: string }).chatMode === 'admin_only' ? 'Admin only' : 'Everyone'
            }</strong></div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {meeting.status === 'scheduled' && (
          <button type="button" onClick={() => handleStatusChange('live')} style={{ ...adminBtnPrimary, background: '#16a34a' }}>
            Start Meeting
          </button>
        )}
        {meeting.status === 'live' && (
          <>
            <button type="button" onClick={handleJoin} disabled={joining} style={adminBtnPrimary}>
              {joining ? 'Opening...' : 'Join as Host'}
            </button>
            {!recording && !hasActiveRecording ? (
              <button type="button" onClick={handleStartRecording} disabled={recordingLoading} style={{ ...adminBtnPrimary, background: '#dc2626' }}>
                {recordingLoading ? 'Starting...' : 'Start Recording'}
              </button>
            ) : (
              <button type="button" onClick={handleStopRecording} disabled={recordingLoading} style={{ ...adminBtnPrimarySm, background: '#dc2626', padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>
                {recordingLoading ? 'Stopping...' : 'Stop Recording'}
              </button>
            )}
            <button type="button" onClick={() => handleStatusChange('ended')} style={{ ...adminBtnPrimary, background: '#6b7280' }}>
              End Meeting
            </button>
          </>
        )}
        {meeting.status !== 'ended' && (
          <button type="button" onClick={handleDelete} style={adminBtnDestructiveTable}>Delete</button>
        )}
      </div>

      {/* Share link */}
      {shareLink && meeting.status !== 'ended' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Shareable Meeting Link</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              readOnly
              value={shareLink}
              style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem' }}
              onFocus={(e) => e.target.select()}
            />
            <button type="button" onClick={handleCopyLink} style={adminBtnPrimarySm}>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* Email invite */}
      {meeting.status !== 'ended' && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Send Email Invite</h3>
          <textarea
            value={inviteEmails}
            onChange={(e) => setInviteEmails(e.target.value)}
            placeholder="Enter email addresses, separated by commas or new lines"
            rows={3}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', resize: 'vertical' }}
          />
          <button
            type="button"
            onClick={handleSendInvites}
            disabled={sending || !inviteEmails.trim()}
            style={{ ...adminBtnPrimarySm, marginTop: '0.5rem', opacity: sending || !inviteEmails.trim() ? 0.65 : 1 }}
          >
            {sending ? 'Sending...' : 'Send Invites'}
          </button>
        </div>
      )}

      {/* Recordings */}
      {meeting.recordings && meeting.recordings.length > 0 && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Recordings</h3>
          {meeting.recordings.map((r) => {
            const isReady = Boolean(r.storageKey || r.playbackUrl);
            const isProcessing = !isReady;
            const playbackHref = r.storageKey
              ? `${(import.meta.env.VITE_API_URL ?? '')}/api/v1/meetings/${meeting.id}/recordings/${r.id}/playback`
              : r.playbackUrl;

            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
                <span>{new Date(r.createdAt).toLocaleString()}</span>
                {r.durationSeconds != null && <span style={{ color: 'var(--color-text-muted)' }}>{Math.round(r.durationSeconds / 60)} min</span>}
                {isProcessing && (
                  <span style={{ color: '#d97706', fontStyle: 'italic' }}>Processing...</span>
                )}
                {isReady && playbackHref && (
                  <a href={playbackHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Play</a>
                )}
                {isReady && playbackHref && (
                  <a href={playbackHref} download style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.8rem' }}>Download</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
