import { CSSProperties } from 'react';

interface Props {
  show: boolean;
  message: string;
  violationCount: number;
  onDismiss: () => void;
}

export default function BrowserRestrictionOverlay({ show, message, violationCount, onDismiss }: Props) {
  if (!show) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={iconStyle}>!</div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#ef4444' }}>
          Test Integrity Warning
        </h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          {message}
        </p>
        {violationCount > 1 && (
          <p style={{ margin: '0 0 1rem', color: '#f59e0b', fontSize: '0.85rem' }}>
            Total violations recorded: {violationCount}
          </p>
        )}
        <button onClick={onDismiss} style={buttonStyle}>
          Return to Test
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle: CSSProperties = {
  background: 'var(--color-surface, #1a1a2e)',
  border: '2px solid #ef4444',
  borderRadius: '12px',
  padding: '2rem',
  maxWidth: '420px',
  textAlign: 'center',
};

const iconStyle: CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  background: 'rgba(239,68,68,0.15)',
  color: '#ef4444',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.5rem',
  fontWeight: 700,
  margin: '0 auto 1rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.6rem 1.5rem',
  background: 'var(--color-primary, #6366f1)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
};
