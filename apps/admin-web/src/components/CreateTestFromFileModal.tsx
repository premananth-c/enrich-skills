import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';

const defaultConfig = {
  durationMinutes: 60,
  attemptLimit: 3,
  shuffleQuestions: false,
  showResultsImmediately: true,
  partialScoring: true,
  proctoringEnabled: false,
  aiFeedbackEnabled: false,
  passPercentage: 40,
  scoreDistribution: 'equal' as const,
  questionWeights: {} as Record<string, number>,
};

/** Row from sheet: Row 1: B1=Title, I1=Explanation (header). Row 2 onwards: B=question, C=Option A, D=Option B, E=Option C, F=Option D, G=Correct Key, H=Weightage, I=Explanation (data). */
function parseSheet(workbook: XLSX.WorkBook): { title: string; rows: { question: string; optA: string; optB: string; optC: string; optD: string; correctKey: string; weight: number | null; explanation: string }[] } {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { title: '', rows: [] };
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];
  if (data.length < 2) return { title: '', rows: [] };
  const title = String(data[0][1] ?? '').trim() || 'Imported Test';
  const rows: { question: string; optA: string; optB: string; optC: string; optD: string; correctKey: string; weight: number | null; explanation: string }[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const question = String(row?.[1] ?? '').trim();
    if (!question) continue;
    const optA = String(row?.[2] ?? '').trim();
    const optB = String(row?.[3] ?? '').trim();
    const optC = String(row?.[4] ?? '').trim();
    const optD = String(row?.[5] ?? '').trim();
    const correctKey = String(row?.[6] ?? 'A').trim().toUpperCase().slice(0, 1);
    let weight: number | null = null;
    const rawWeight = row?.[7];
    if (rawWeight !== undefined && rawWeight !== null && rawWeight !== '') {
      const w = Number(rawWeight);
      if (Number.isFinite(w) && w >= 0) weight = w;
    }
    const explanation = String(row?.[8] ?? '').trim();
    rows.push({ question, optA, optB, optC, optD, correctKey, weight, explanation });
  }
  return { title, rows };
}

interface CreateTestFromFileModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTestFromFileModal({ onClose, onCreated }: CreateTestFromFileModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setError('Please upload a .xlsx or .xls file.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const { title, rows } = parseSheet(workbook);
      if (rows.length === 0) {
        setError('No valid question rows found. Ensure row 1 has test title in B1 and Explanation header in I1; data from row 2: Question in B, Options in C–F, Correct Key in G, Weightage in H, Explanation in I.');
        setUploading(false);
        return;
      }
      const questionIds: string[] = [];
      const questionWeights: Record<string, number> = {};
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const options = [
          { text: r.optA || 'Option A', isCorrect: r.correctKey === 'A' },
          { text: r.optB || 'Option B', isCorrect: r.correctKey === 'B' },
          { text: r.optC || 'Option C', isCorrect: r.correctKey === 'C' },
          { text: r.optD || 'Option D', isCorrect: r.correctKey === 'D' },
        ];
        const created = await api<{ id: string }>('/questions/mcq', {
          method: 'POST',
          silent: true,
          body: JSON.stringify({
            title: r.question.slice(0, 200) || `Question ${i + 1}`,
            description: r.question,
            difficulty: 'easy',
            tags: [],
            options,
            defaultWeight: r.weight !== null && Number.isFinite(r.weight) ? r.weight : 1,
            ...(r.explanation && { explanation: r.explanation }),
          }),
        });
        questionIds.push(created.id);
        if (r.weight !== null) questionWeights[created.id] = r.weight;
      }
      const config = {
        ...defaultConfig,
        scoreDistribution: Object.keys(questionWeights).length > 0 ? ('custom' as const) : ('equal' as const),
        questionWeights,
      };
      const test = await api<{ id: string }>('/tests', {
        method: 'POST',
        silent: true,
        body: JSON.stringify({
          title: title || 'Imported Test',
          type: 'mcq',
          config,
          questionIds,
        }),
      });
      onCreated();
      onClose();
      emitToast('success', 'Test created from file. Fill in other test details and click Update.');
      navigate(`/tests/${test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '1.5rem',
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem' }}>Create Test From File</h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Upload a .xlsx or .xls file (see <code style={{ fontSize: '0.85em' }}>docs/test-template.xlsx</code> for reference). Row 1: <strong>B1</strong> = Test title, <strong>I1</strong> = Explanation (header). From row 2: <strong>B</strong> = Question, <strong>C–F</strong> = Options A–D, <strong>G</strong> = Correct key (A/B/C/D), <strong>H</strong> = Weightage (optional), <strong>I</strong> = Explanation (optional). The test is created as <strong>Draft</strong>. Fill in other test details on the test page and click <strong>Update</strong>.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          disabled={uploading}
          style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}
        />
        {error && <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: '#ef444422', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>{error}</div>}
        {uploading && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Creating questions and test…</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} disabled={uploading} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text-muted)' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
