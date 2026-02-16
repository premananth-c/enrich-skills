import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Question {
  id: string;
  type: string;
  content: { title: string };
  difficulty: string;
}

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Question[]>('/questions')
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1 style={{ margin: '0 0 1rem' }}>Question Bank</h1>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
        {questions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>No questions yet.</div>
        ) : (
          questions.map((q) => (
            <div key={q.id} style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{(q.content as { title: string }).title}</strong>
                <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{q.type} • {q.difficulty}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
