import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface JoinTokenResponse {
  token: string;
  roomUrl: string;
  isOwner: boolean;
  meetingType: 'interactive_meeting' | 'webinar';
  config: Record<string, unknown>;
}

interface MeetingInfo {
  id: string;
  name: string;
  type: 'interactive_meeting' | 'webinar';
  status: 'scheduled' | 'live' | 'ended';
  scheduledAt: string | null;
}

export default function JoinMeeting() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
  const [joinData, setJoinData] = useState<JoinTokenResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!meetingId) return;
    api<MeetingInfo>(`/meetings/${meetingId}`)
      .then(setMeeting)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load meeting'))
      .finally(() => setLoading(false));
  }, [meetingId]);

  const handleJoin = async () => {
    if (!meetingId) return;
    setJoining(true);
    setError('');
    try {
      const data = await api<JoinTokenResponse>(`/meetings/${meetingId}/join-token`, { method: 'POST' });
      setJoinData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join meeting');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    setJoinData(null);
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading meeting...</p>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => navigate('/')} style={{ padding: '0.5rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  // In-meeting view: embed Daily.co prebuilt iframe
  if (joinData) {
    const iframeSrc = `${joinData.roomUrl}?t=${joinData.token}`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontWeight: 600 }}>{meeting?.name}</span>
          <button onClick={handleLeave} style={{ padding: '0.35rem 0.85rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
            Leave Meeting
          </button>
        </div>
        <iframe
          src={iframeSrc}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ flex: 1, border: 'none', width: '100%' }}
          title={meeting?.name ?? 'Meeting'}
        />
      </div>
    );
  }

  // Pre-join lobby
  const typeLabel = meeting?.type === 'webinar' ? 'Webinar' : 'Live Meeting';
  const isLive = meeting?.status === 'live';
  const isEnded = meeting?.status === 'ended';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '2rem', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 0.5rem' }}>{meeting?.name}</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: '0 0 0.25rem', fontSize: '0.9rem' }}>{typeLabel}</p>
        {meeting?.scheduledAt && (
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 1rem', fontSize: '0.85rem' }}>
            Scheduled: {new Date(meeting.scheduledAt).toLocaleString()}
          </p>
        )}

        {isEnded && (
          <p style={{ color: '#6b7280', fontWeight: 500 }}>This meeting has ended.</p>
        )}

        {!isLive && !isEnded && (
          <p style={{ color: '#2563eb', fontWeight: 500 }}>This meeting has not started yet. Please wait for the host to start it.</p>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p>}

        {isLive && (
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              padding: '0.65rem 2rem',
              background: 'var(--color-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '1rem',
              cursor: joining ? 'not-allowed' : 'pointer',
              opacity: joining ? 0.65 : 1,
              marginTop: '0.5rem',
            }}
          >
            {joining ? 'Joining...' : 'Join Meeting'}
          </button>
        )}

        <button
          onClick={() => navigate('/')}
          style={{ display: 'block', margin: '1rem auto 0', background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
