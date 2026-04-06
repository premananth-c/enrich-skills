import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

export type PickerOption = { id: string; label: string };

const defaultInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  color: 'var(--color-text)',
  fontSize: '0.95rem',
};

function matchesQuery(option: PickerOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return option.label.toLowerCase().includes(q);
}

type Props = {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  maxWidth?: number | string;
  id?: string;
};

/**
 * Type-to-filter picker for batches, tests, etc. Same interaction model as StudentSearchCombobox.
 */
export function SearchablePickerCombobox({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  emptyMessage = 'No matches',
  maxWidth = 320,
  id: idProp,
}: Props) {
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sentinel = options.find((o) => o.id === '');
    const others = options.filter((o) => o.id !== '');
    const matchedOthers = others.filter((o) => matchesQuery(o, query));
    if (sentinel) {
      const sentinelVisible = !q || sentinel.label.toLowerCase().includes(q);
      return sentinelVisible ? [sentinel, ...matchedOthers] : matchedOthers;
    }
    return options.filter((o) => matchesQuery(o, query));
  }, [options, query]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlight]);

  useEffect(() => {
    return () => {
      if (blurCloseTimer.current) clearTimeout(blurCloseTimer.current);
    };
  }, []);

  const cancelBlurClose = useCallback(() => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelBlurClose();
    blurCloseTimer.current = setTimeout(() => {
      setOpen(false);
      setQuery('');
      blurCloseTimer.current = null;
    }, 120);
  }, [cancelBlurClose]);

  const pick = useCallback(
    (id: string) => {
      cancelBlurClose();
      onChange(id);
      setOpen(false);
      setQuery('');
      setHighlight(0);
    },
    [cancelBlurClose, onChange]
  );

  const handleFocus = () => {
    cancelBlurClose();
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setHighlight(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    setQuery(e.target.value);
    setOpen(true);
    setHighlight(0);
    if (value) onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      setQuery('');
      setHighlight(0);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      pick(filtered[highlight]?.id ?? filtered[0].id);
    }
  };

  const displayValue = open ? query : selected ? selected.label : '';

  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      if (!containerRef.current?.contains(ev.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const showList = open && !disabled;
  const inputId = idProp ?? `${reactId}-input`;

  return (
    <div ref={containerRef} style={{ position: 'relative', maxWidth, width: '100%' }}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        placeholder={selected && !open ? undefined : placeholder}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={scheduleClose}
        onKeyDown={handleKeyDown}
        style={{
          ...defaultInputStyle,
          opacity: disabled ? 0.65 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 50,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 2,
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '0.25rem 0',
            listStyle: 'none',
            margin: 0,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '0.5rem 0.75rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{emptyMessage}</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.id}
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o.id);
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  background: i === highlight ? 'var(--color-bg)' : 'transparent',
                  color: 'var(--color-text)',
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
