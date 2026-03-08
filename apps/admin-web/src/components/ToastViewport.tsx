import { useEffect, useState } from 'react';
import { TOAST_EVENT_NAME, type ToastEventDetail } from '../lib/toast';

interface ToastItem extends ToastEventDetail {
  id: string;
}

const toastColor: Record<ToastEventDetail['type'], { bg: string; border: string }> = {
  success: { bg: '#166534', border: '#22c55e' },
  error: { bg: '#7f1d1d', border: '#ef4444' },
  info: { bg: '#1e3a8a', border: '#3b82f6' },
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<ToastEventDetail>;
      const detail = custom.detail;
      if (!detail?.message) return;
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((prev) => [...prev, { id, ...detail }].slice(-5));

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    };

    window.addEventListener(TOAST_EVENT_NAME, onToast as EventListener);
    return () => window.removeEventListener(TOAST_EVENT_NAME, onToast as EventListener);
  }, []);

  return (
    <div
      className="toast-viewport"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const colors = toastColor[toast.type];
        return (
          <div
            key={toast.id}
            className="toast-item"
            style={{
              minWidth: 260,
              maxWidth: 420,
              padding: '0.7rem 0.9rem',
              background: colors.bg,
              color: '#fff',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              fontSize: '0.9rem',
              fontWeight: 500,
              animation: 'toast-in 220ms ease-out, toast-out 220ms ease-in 2980ms forwards',
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
