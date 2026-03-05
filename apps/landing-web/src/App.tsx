import { useRef, useState } from 'react';

const API_BASE = '/api/v1';

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

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div>
      {/* Hero */}
      <header
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          color: '#fff',
          padding: '4rem 1.5rem 5rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700 }}>
            Ranker Ship
          </h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.1rem', opacity: 0.9 }}>
            by Vihaan Digital Solutions
          </p>
          <p style={{ margin: '1.5rem 0 0', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Practice coding & mock tests. Get AI-powered feedback. Ace your assessments.
          </p>
          <button
            onClick={scrollToForm}
            style={{
              ...buttonStyle,
              marginTop: '2rem',
              background: '#fff',
              color: '#4338ca',
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
          background: '#1e293b',
          color: '#94a3b8',
          textAlign: 'center',
          fontSize: '0.9rem',
        }}
      >
        <p style={{ margin: 0 }}>© Vihaan Digital Solutions</p>
        <p style={{ margin: '0.75rem 0 0' }}>
          <a
            href={`${import.meta.env.VITE_STUDENT_URL || 'http://localhost:5173'}/login`}
            style={{ color: '#818cf8', textDecoration: 'none' }}
          >
            Student Login
          </a>
          {' · '}
          <a
            href={`${import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'}/login`}
            style={{ color: '#818cf8', textDecoration: 'none' }}
          >
            Admin Login
          </a>
        </p>
      </footer>
    </div>
  );
}
