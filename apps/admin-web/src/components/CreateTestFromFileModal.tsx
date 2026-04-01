import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';

const defaultConfig = {
  durationMinutes: 60,
  attemptLimit: 3,
  shuffleQuestions: false,
  showResultsPerQuestion: true,
  showResultsImmediately: true,
  partialScoring: true,
  proctoringEnabled: false,
  aiFeedbackEnabled: false,
  passPercentage: 40,
  scoreDistribution: 'equal' as const,
  questionWeights: {} as Record<string, number>,
};

type ParsedRow = {
  /** Short title (Questions column). */
  title: string;
  description: string;
  tags: string[];
  optionLetters: string[];
  optionTexts: string[];
  correctKey: string;
  weight: number | null;
  explanation: string;
};

/**
 * Normalize row-2 column labels for case-insensitive matching (en-US).
 * Trims, collapses whitespace, strips a leading BOM if present.
 */
function normalizeLabel(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('en-US');
}

/** "Option A", "OPTION B", "option c" → letter A–Z (matching is case-insensitive). */
function parseOptionSchemaLabel(raw: unknown): string | null {
  const m = normalizeLabel(raw).match(/^OPTION\s+([A-Z])/);
  return m ? m[1] : null;
}

/** Map Excel row 2 cell text to column role (see docs/test-template.xlsx). All names matched case-insensitively. */
function classifySchemaLabel(raw: unknown): 'title' | 'description' | 'tags' | 'key' | 'weight' | 'explanation' | 'option' | null {
  const n = normalizeLabel(raw);
  if (n === 'QUESTIONS' || n === 'QUESTION') return 'title';
  if (n === 'DESCRIPTION') return 'description';
  if (n === 'TAGS' || n === 'TAG') return 'tags';
  if (n === 'KEY' || n === 'ANS KEY' || n === 'ANSWER KEY' || n === 'CORRECT KEY') return 'key';
  if (n === 'WEIGHT' || n === 'WEIGHTAGE') return 'weight';
  if (n === 'EXPLANATION' || n === 'EXPLAIN') return 'explanation';
  if (parseOptionSchemaLabel(raw)) return 'option';
  return null;
}

function parseTagsCell(raw: unknown): string[] {
  const s = String(raw ?? '').trim();
  if (!s) return [];
  return s
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** First A–Z character in the cell that exists in `letters`, else first listed letter. */
function normalizeCorrectKey(raw: unknown, letters: string[]): string {
  const s = String(raw ?? '').trim().toUpperCase();
  for (const ch of s) {
    if (/[A-Z]/.test(ch) && letters.includes(ch)) return ch;
  }
  return letters[0] ?? 'A';
}

/**
 * B1 (row 1) = test title. Row 2 (Excel) = schema: each column’s cell names the field (Questions, Description, Option A …, Key, …).
 * Data rows start at Excel row 3.
 */
function parseSheet(workbook: XLSX.WorkBook): { title: string; rows: ParsedRow[]; error?: string } {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { title: '', rows: [] };
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];
  if (data.length < 3) {
    return {
      title: '',
      rows: [],
      error: 'The sheet needs at least 3 rows: B1 = test title, row 2 = column labels, row 3+ = questions.',
    };
  }
  const testTitle = String(data[0][1] ?? '').trim() || 'Imported Test';

  const schemaRow = data[1];
  const rowWidth = Math.max(...data.map((r) => (Array.isArray(r) ? r.length : 0)), schemaRow.length || 0);

  const optionByLetter = new Map<string, number>();
  let titleCol: number | undefined;
  let descCol: number | undefined;
  let tagsCol: number | undefined;
  let keyCol: number | undefined;
  let weightCol: number | undefined;
  let explCol: number | undefined;

  for (let c = 0; c < rowWidth; c++) {
    const cell = schemaRow[c];
    if (!normalizeLabel(cell)) continue;
    const role = classifySchemaLabel(cell);
    if (role === 'option') {
      const letter = parseOptionSchemaLabel(cell);
      if (letter && !optionByLetter.has(letter)) optionByLetter.set(letter, c);
      continue;
    }
    if (role === 'title' && titleCol === undefined) titleCol = c;
    else if (role === 'description' && descCol === undefined) descCol = c;
    else if (role === 'tags' && tagsCol === undefined) tagsCol = c;
    else if (role === 'key' && keyCol === undefined) keyCol = c;
    else if (role === 'weight' && weightCol === undefined) weightCol = c;
    else if (role === 'explanation' && explCol === undefined) explCol = c;
  }

  const optionLetters = [...optionByLetter.keys()].sort((a, b) => a.localeCompare(b));

  if (titleCol === undefined) {
    return {
      title: testTitle,
      rows: [],
      error: 'Row 2 must include a Questions (or Question) column label.',
    };
  }
  if (keyCol === undefined) {
    return {
      title: testTitle,
      rows: [],
      error: 'Row 2 must include a Key (or Ans Key) column label.',
    };
  }
  if (optionLetters.length < 2) {
    return {
      title: testTitle,
      rows: [],
      error: 'Row 2 must include at least two columns labeled Option A, Option B, … (letter after Option).',
    };
  }

  const rows: ParsedRow[] = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const titleText = String(row?.[titleCol] ?? '').trim();
    if (!titleText) continue;

    const description = String(descCol !== undefined ? row?.[descCol] ?? '' : '').trim();
    const tags = tagsCol !== undefined ? parseTagsCell(row?.[tagsCol]) : [];
    const optionTextsOut = optionLetters.map((letter) => String(row?.[optionByLetter.get(letter)!] ?? '').trim());
    const correctKey = normalizeCorrectKey(row?.[keyCol], optionLetters);

    let weight: number | null = null;
    const rawWeight = weightCol !== undefined ? row?.[weightCol] : undefined;
    if (rawWeight !== undefined && rawWeight !== null && rawWeight !== '') {
      const w = Number(rawWeight);
      if (Number.isFinite(w) && w >= 0) weight = w;
    }

    const explanation = String(explCol !== undefined ? row?.[explCol] ?? '' : '').trim();

    rows.push({
      title: titleText,
      description,
      tags,
      optionLetters,
      optionTexts: optionTextsOut,
      correctKey,
      weight,
      explanation,
    });
  }
  return { title: testTitle, rows };
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
      const { title, rows, error: sheetError } = parseSheet(workbook);
      if (sheetError) {
        setError(sheetError);
        setUploading(false);
        return;
      }
      if (rows.length === 0) {
        setError(
          'No question rows found after row 2. Ensure row 2 labels each column (Questions, Description, Tags, Option A…, Key, Weight, Explanation) and add data from row 3 onward. B1 = test title.'
        );
        setUploading(false);
        return;
      }
      const questionIds: string[] = [];
      const questionWeights: Record<string, number> = {};
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const options = r.optionLetters.map((letter, idx) => ({
          text: r.optionTexts[idx] || `Option ${letter}`,
          isCorrect: r.correctKey === letter,
        }));
        const rawTitle = r.title.trim() || `Question ${i + 1}`;
        const title = rawTitle.length >= 2 ? rawTitle : `${rawTitle}.`;
        const created = await api<{ id: string }>('/questions/mcq', {
          method: 'POST',
          silent: true,
          body: JSON.stringify({
            title,
            ...(r.description ? { description: r.description } : {}),
            difficulty: 'easy',
            tags: r.tags,
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
          Use <code style={{ fontSize: '0.85em' }}>docs/test-template.xlsx</code>. <strong>B1</strong> = test title. <strong>Row 2</strong> names each column: Questions (title), Description, Tags, <strong>Option A</strong> / <strong>Option B</strong> / … (letter after Option; options ordered A–Z), Key (correct letter), Weight, Explanation. <strong>Data from row 3.</strong> Draft test; finish details on the test page and click <strong>Update</strong>.
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
