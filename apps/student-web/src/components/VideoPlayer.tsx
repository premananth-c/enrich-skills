import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../lib/api';

interface VideoPlayerProps {
  materialId: string;
  title?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const TOKEN_REFRESH_MS = 90 * 60 * 1000;

export default function VideoPlayer({ materialId, title }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchToken = useCallback(async () => {
    try {
      const data = await api<{ url: string }>(`/stream/materials/${materialId}/token`);
      const base = import.meta.env.VITE_API_URL ?? '';
      setStreamUrl(`${base}${data.url}`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load video');
    }
  }, [materialId]);

  useEffect(() => {
    fetchToken();
    refreshTimer.current = setInterval(fetchToken, TOKEN_REFRESH_MS);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [fetchToken]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  if (error) {
    return (
      <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', fontSize: '0.9rem' }}>
        {error}
      </div>
    );
  }

  if (!streamUrl) {
    return <div style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>Loading video...</div>;
  }

  return (
    <div
      style={{ position: 'relative', width: '100%', maxWidth: 800, background: '#000', borderRadius: 8, overflow: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {title && (
        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
          {title}
        </div>
      )}
      <video
        ref={videoRef}
        src={streamUrl}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        playsInline
        style={{ width: '100%', display: 'block' }}
        onError={() => setError('Video playback error. Try refreshing.')}
      />
      <div style={{ position: 'absolute', bottom: 48, right: 12 }}>
        <button
          onClick={() => setShowSpeedMenu((p) => !p)}
          style={{
            padding: '4px 10px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          {speed}x
        </button>
        {showSpeedMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 4,
              background: 'rgba(0,0,0,0.9)',
              borderRadius: 6,
              overflow: 'hidden',
              minWidth: 60,
            }}
          >
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setSpeed(s); setShowSpeedMenu(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 14px',
                  background: s === speed ? 'var(--color-primary)' : 'transparent',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
