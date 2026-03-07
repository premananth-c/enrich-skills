import { useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1';

function EnquiryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const name = (fd.get('name') as string)?.trim();
    const email = (fd.get('email') as string)?.trim();
    const phone = (fd.get('phone') as string)?.trim();
    const category = fd.get('category') as string;
    const message = (fd.get('message') as string)?.trim();
    if (!name || !email || !phone || !category || !message) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, category, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data?.error;
        let msg = 'Submission failed. Please try again.';
        if (typeof err === 'string') msg = err;
        else if (err && typeof err === 'object') {
          const fe = (err as { formErrors?: string[] }).formErrors;
          const fieldErr = (err as { fieldErrors?: Record<string, string[]> }).fieldErrors;
          if (Array.isArray(fe) && fe[0]) msg = fe[0];
          else if (fieldErr) {
            const first = Object.values(fieldErr).flat().find(Boolean);
            if (first) msg = first;
          }
        }
        setError(msg);
        return;
      }
      setSubmitted(true);
      form.reset();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          padding: '2rem',
          background: '#dcfce7',
          borderRadius: 12,
          textAlign: 'center',
          color: '#166534',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Thank you for your enquiry!</p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem' }}>
          We will get in touch with you soon.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      style={{
        display: 'grid',
        gap: '1rem',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 8,
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}
      <input
        name="name"
        type="text"
        placeholder="Your name *"
        required
        maxLength={200}
        style={inputStyle}
      />
      <input
        name="email"
        type="email"
        placeholder="Email *"
        required
        style={inputStyle}
      />
      <input
        name="phone"
        type="tel"
        placeholder="Phone number *"
        required
        minLength={10}
        maxLength={20}
        style={inputStyle}
      />
      <select name="category" required style={{ ...inputStyle, cursor: 'pointer' }}>
        <option value="">Select category *</option>
        <option value="student">Student</option>
        <option value="college">College</option>
        <option value="corporate">Corporate</option>
        <option value="academic">Academic Institution</option>
      </select>
      <textarea
        name="message"
        placeholder="Describe your needs *"
        required
        maxLength={2000}
        rows={4}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Submitting...' : 'Submit Enquiry'}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: '1rem',
  background: '#fff',
};
const buttonStyle: React.CSSProperties = {
  padding: '0.85rem 1.5rem',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const sectionStyle: React.CSSProperties = {
  padding: '4rem 1.5rem',
  maxWidth: 960,
  margin: '0 auto',
};

export default function App() {
  const formRef = useRef<HTMLDivElement>(null);
  const studentUrl = import.meta.env.VITE_STUDENT_URL || 'http://localhost:5173';
  const adminUrl = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174';

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div>
      {/* Top Nav */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 2rem',
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem' }}>
          <img src="/logo.png" alt="RankerShip" style={{ height: 44, display: 'block' }} />
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', lineHeight: 1, paddingBottom: '2px' }}>by Vihaan Digital Solutions</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a
            href={`${studentUrl}/login`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#334155',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              padding: '0.5rem 1.25rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              transition: 'background 0.15s',
            }}
          >
            Student Login
          </a>
          <a
            href={`${adminUrl}/login`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#fff',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              padding: '0.5rem 1.25rem',
              borderRadius: 6,
              background: '#4338ca',
              transition: 'background 0.15s',
            }}
          >
            Admin Login
          </a>
        </div>
      </nav>

      {/* Hero */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 60%, #4338ca 85%, #6366f1 100%)',
          color: '#fff',
          padding: '6rem 1.5rem 7rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            left: '-10%',
            width: '50%',
            height: '140%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40%',
            right: '-5%',
            width: '45%',
            height: '130%',
            background: 'radial-gradient(circle, rgba(129,140,248,0.12) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '10%',
            right: '15%',
            width: '25%',
            height: '50%',
            background: 'radial-gradient(circle, rgba(67,56,202,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
          }}
        />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <h1 style={{ margin: 0, fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Learn, Practice, and Succeed
            <br />
            <span style={{ background: 'linear-gradient(90deg, #c7d2fe, #a5b4fc, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              on One Unified Platform.
            </span>
          </h1>
          <p style={{ margin: '1.75rem auto 0', fontSize: '1.15rem', lineHeight: 1.8, color: '#cbd5e1', maxWidth: 660 }}>
            From live recordings and MCQ marathons to complex coding assessments, RankerShip combines a world-class LMS with high-stakes testing environments — powered by <span style={{ color: '#a5b4fc', fontWeight: 600 }}>AI-driven analysis and reporting</span> that gives every learner a clear path to improve.
          </p>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1.5rem',
              marginTop: '2rem',
              flexWrap: 'wrap',
            }}
          >
            {[
              { icon: '\u2728', text: 'AI Feedback on Every Attempt' },
              { icon: '\uD83D\uDCCA', text: 'Smart Performance Reports' },
              { icon: '\uD83C\uDFAF', text: 'Personalized Recommendations' },
            ].map((item) => (
              <div
                key={item.text}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  color: '#e2e8f0',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <button
            onClick={scrollToForm}
            style={{
              ...buttonStyle,
              marginTop: '2.5rem',
              background: '#fff',
              color: '#4338ca',
              fontSize: '1.1rem',
              padding: '1rem 2.5rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}
          >
            Get Access
          </button>
        </div>
      </header>

      {/* For Students */}
      <section style={{ ...sectionStyle, background: '#fff' }}>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.75rem' }}>For Students</h2>
        <ul style={{ paddingLeft: '1.5rem', lineHeight: 2, color: '#475569' }}>
          <li>Practice coding and MCQ tests in a realistic interview environment</li>
          <li>AI-powered feedback on code quality, problem-solving, and efficiency</li>
          <li>Detailed result review with per-question ratings and explanations</li>
          <li>Track your progress with streaks, topics, and recommendations</li>
          <li>Calendar and notifications for scheduled tests</li>
        </ul>
      </section>

      {/* For Business */}
      <section style={{ ...sectionStyle, background: '#f1f5f9' }}>
        <h2 style={{ margin: '0 0 1.5rem', fontSize: '1.75rem' }}>
          For Colleges, Corporates & Academic Institutions
        </h2>
        <ul style={{ paddingLeft: '1.5rem', lineHeight: 2, color: '#475569' }}>
          <li>White-label branded portal for your institution</li>
          <li>Create tests, build question banks, and manage cohorts</li>
          <li>Reports and analytics at cohort and candidate level</li>
          <li>Multi-tenant isolation with secure, role-based access</li>
          <li>Invite workflows for students and proctoring support</li>
        </ul>
      </section>

      {/* Enquiry Form */}
      <section
        ref={formRef}
        style={{
          ...sectionStyle,
          background: '#fff',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem', textAlign: 'center' }}>
          Get Access
        </h2>
        <p
          style={{
            margin: '0 0 2rem',
            textAlign: 'center',
            color: '#64748b',
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Tell us about your needs. We will reach out shortly.
        </p>
        <EnquiryForm />
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '2rem 1.5rem',
          background: '#0f172a',
          color: '#94a3b8',
          textAlign: 'center',
          fontSize: '0.9rem',
        }}
      >
        <img src="/logo.png" alt="RankerShip" style={{ height: 28, marginBottom: '0.75rem', opacity: 0.8 }} />
        <p style={{ margin: 0 }}>&copy; Vihaan Digital Solutions</p>
        <p style={{ margin: '0.75rem 0 0' }}>
          <a
            href={`${studentUrl}/login`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#818cf8', textDecoration: 'none' }}
          >
            Student Login
          </a>
          {' · '}
          <a
            href={`${adminUrl}/login`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#818cf8', textDecoration: 'none' }}
          >
            Admin Login
          </a>
        </p>
      </footer>
    </div>
  );
}
