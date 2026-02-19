import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ValidateResponse {
  valid: boolean;
  email: string;
  expiresAt: string;
  testTitle?: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '6px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  marginBottom: '1rem',
  fontSize: '1rem',
};

export default function InviteSignup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { registerWithInvite } = useAuth();

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [inviteEmail, setInviteEmail] = useState('');
  const [testTitle, setTestTitle] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError('Missing invite token');
      return;
    }
    fetch(`/api/v1/invites/validate?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: ValidateResponse | { error?: string }) => {
        if ('error' in data) {
          setStatus('invalid');
          setError(data.error || 'Invalid or expired invite');
          return;
        }
        if (data.valid && data.email) {
          setStatus('valid');
          setInviteEmail(data.email);
          setTestTitle(data.testTitle || null);
        } else {
          setStatus('invalid');
          setError('Invalid or expired invite link');
        }
      })
      .catch(() => {
        setStatus('invalid');
        setError('Could not validate invite. Please check the link and try again.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      await registerWithInvite(token, password, name, phoneNumber, address);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface) 100%)' }}>
        <div style={{ color: 'var(--color-text-muted)' }}>Validating invite...</div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface) 100%)' }}>
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2rem', maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: 'var(--color-text)' }}>Invalid or expired invite</h1>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-muted)' }}>{error}</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>This link may have expired (invites are valid for 2 days) or have already been used. Ask your instructor for a new invite.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface) 100%)' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '420px' }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>Create your account</h1>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          You were invited to join. Complete your profile below. This link expires in 2 days.
          {testTitle && <span><br />You have been assigned to: <strong>{testTitle}</strong></span>}
        </p>
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>{error}</div>
        )}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Email</label>
          <input type="email" value={inviteEmail} readOnly style={{ ...inputStyle, opacity: 0.9 }} />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Password (min 8 characters)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Full name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} style={inputStyle} />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Phone number</label>
          <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required style={inputStyle} placeholder="e.g. +1 234 567 8900" />
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Address</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={2} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Street, city, state, country" />
          <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.75rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 500, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}
