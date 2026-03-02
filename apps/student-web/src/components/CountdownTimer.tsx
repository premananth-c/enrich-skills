import { useEffect, useState } from 'react';

interface Props {
  startedAt: string;
  durationMinutes: number;
  onExpire: () => void;
}

export default function CountdownTimer({ startedAt, durationMinutes, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() => {
    const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    return Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const timer = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
          onExpire();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isLow = remaining < 300;

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1rem',
        fontWeight: 600,
        color: isLow ? '#ef4444' : 'var(--color-text)',
        background: isLow ? 'rgba(239,68,68,0.15)' : 'var(--color-surface)',
        border: `1px solid ${isLow ? '#ef4444' : 'var(--color-border)'}`,
        padding: '0.35rem 0.75rem',
        borderRadius: '6px',
      }}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}
