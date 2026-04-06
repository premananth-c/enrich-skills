import type { CSSProperties } from 'react';

/** Primary CTA — purple, white text. Use Title Case labels (e.g. "Bulk Invite"). */
export const adminBtnPrimary: CSSProperties = {
  padding: '0.5rem 1.25rem',
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 500,
  fontSize: '0.9rem',
  cursor: 'pointer',
};

export function adminBtnPrimaryDisabled(disabled: boolean): CSSProperties {
  return {
    ...adminBtnPrimary,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export const adminBtnPrimarySm: CSSProperties = {
  ...adminBtnPrimary,
  padding: '0.35rem 0.65rem',
  fontSize: '0.8rem',
};

export function adminBtnPrimarySmDisabled(disabled: boolean): CSSProperties {
  return {
    ...adminBtnPrimarySm,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

/** Compact primary for dense toolbars (e.g. test question row). */
export const adminBtnPrimaryCompact: CSSProperties = {
  ...adminBtnPrimary,
  padding: '0.4rem 1rem',
  fontSize: '0.9rem',
};

/** Cancel / neutral — grey outline (unchanged look). */
export const adminBtnCancel: CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  color: 'var(--color-text-muted)',
  fontSize: '0.9rem',
  cursor: 'pointer',
};

export const adminBtnCancelSm: CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  color: 'var(--color-text-muted)',
  fontSize: '0.8rem',
  cursor: 'pointer',
};

/** Delete, remove, archive, revoke invite — red background, white text. */
export const adminBtnDestructive: CSSProperties = {
  padding: '0.35rem 0.65rem',
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
};

export const adminBtnDestructiveTable: CSSProperties = {
  padding: '4px 10px',
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
};

export function adminBtnDestructiveTableDisabled(disabled: boolean): CSSProperties {
  return {
    ...adminBtnDestructiveTable,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export const adminBtnDestructiveMd: CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
};

export function adminBtnDestructiveMdDisabled(disabled: boolean): CSSProperties {
  return {
    ...adminBtnDestructiveMd,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function adminBtnDestructiveDisabled(disabled: boolean): CSSProperties {
  return {
    ...adminBtnDestructive,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
