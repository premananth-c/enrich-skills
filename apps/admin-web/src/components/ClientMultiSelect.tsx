interface ClientOption {
  id: string;
  name: string;
}

interface ClientMultiSelectProps {
  clients: ClientOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.25rem',
  color: 'var(--color-text-muted)',
  fontSize: '0.85rem',
  fontWeight: 500,
};

const boxStyle: React.CSSProperties = {
  width: '100%',
  maxHeight: 160,
  overflowY: 'auto',
  padding: '0.5rem 0.65rem',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
};

export default function ClientMultiSelect({
  clients,
  value,
  onChange,
  disabled,
  label = 'Clients',
  hint,
}: ClientMultiSelectProps) {
  const toggle = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {hint && (
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>{hint}</p>
      )}
      <div style={boxStyle}>
        {clients.length === 0 ? (
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No clients available</span>
        ) : (
          clients.map((c) => (
            <label
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.3rem 0',
                fontSize: '0.95rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={value.includes(c.id)}
                onChange={() => toggle(c.id)}
                disabled={disabled}
              />
              {c.name}
            </label>
          ))
        )}
      </div>
      {value.length > 0 && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          {value.length} client{value.length === 1 ? '' : 's'} selected
        </p>
      )}
    </div>
  );
}
