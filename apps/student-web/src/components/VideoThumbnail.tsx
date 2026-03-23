import { useState } from 'react';
import VideoPlayer from './VideoPlayer';

interface VideoThumbnailProps {
  materialId: string;
  title: string;
}

export default function VideoThumbnail({ materialId, title }: VideoThumbnailProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return <VideoPlayer materialId={materialId} title={title} />;
  }

  return (
    <div
      onClick={() => setPlaying(true)}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 320,
        aspectRatio: '16/9',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginLeft: 3 }}
          >
            <path d="M8 5v14l11-7L8 5z" fill="var(--color-primary)" />
          </svg>
        </div>
      </div>
      <div
        style={{
          padding: '0.5rem 0.75rem',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        🎬 {title}
      </div>
    </div>
  );
}
