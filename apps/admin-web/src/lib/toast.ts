export type ToastType = 'success' | 'error' | 'info';

export interface ToastEventDetail {
  type: ToastType;
  message: string;
}

export const TOAST_EVENT_NAME = 'enrich:toast';

export function emitToast(type: ToastType, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastEventDetail>(TOAST_EVENT_NAME, {
      detail: { type, message },
    })
  );
}
