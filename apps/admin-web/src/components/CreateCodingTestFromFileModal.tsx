import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { emitToast } from '../lib/toast';
import {
  downloadCodingTestTemplate,
  parseCodingTestSheet,
} from '../lib/codingTestTemplate';

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

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateCodingTestFromFileModal({ onClose, onCreated }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
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
    setProgress('Parsing spreadsheet…');
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const result = parseCodingTestSheet(workbook);

      if (result.error) {
        setError(result.error);
        setUploading(false);
        setProgress('');
        return;
      }

      const { testTitle, codingLanguage, questions } = result;
      const questionIds: string[] = [];
      const questionWeights: Record<string, number> = {};

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        setProgress(`Creating question ${i + 1} of ${questions.length}: ${q.title}`);

        const created = await api<{ id: string }>('/questions/coding', {
          method: 'POST',
          silent: true,
          body: JSON.stringify({
            title: q.title,
            description: q.description,
            codingLanguage,
            difficulty: q.difficulty,
            tags: q.tags,
            ...(q.examples.length > 0 && { examples: q.examples }),
            ...(q.constraints.length > 0 && { constraints: q.constraints }),
            ...(q.timeLimitMs != null && { timeLimitMs: q.timeLimitMs }),
            ...(q.memoryLimitMb != null && { memoryLimitMb: q.memoryLimitMb }),
            ...(q.weight != null && { defaultWeight: q.weight }),
            ...(q.starterCode && { starterCode: q.starterCode }),
            testCases: q.testCases,
          }),
        });
        questionIds.push(created.id);
        if (q.weight != null) questionWeights[created.id] = q.weight;
      }

      setProgress('Creating test…');
      const config = {
        ...defaultConfig,
        codingLanguage,
        scoreDistribution:
          Object.keys(questionWeights).length > 0
            ? ('custom' as const)
            : ('equal' as const),
        questionWeights,
      };
      const test = await api<{ id: string }>('/tests', {
        method: 'POST',
        silent: true,
        body: JSON.stringify({
          title: testTitle || 'Imported Coding Test',
          type: 'coding',
          config,
          questionIds,
        }),
      });

      onCreated();
      onClose();
      emitToast(
        'success',
        `Coding test created with ${questions.length} question(s). Fill in remaining details and click Update.`
      );
      navigate(`/tests/${test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUploading(false);
      setProgress('');
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
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem' }}>
          Create Coding Test From File
        </h2>

        <p
          style={{
            margin: '0 0 0.75rem',
            color: 'var(--color-text-muted)',
            fontSize: '0.9rem',
            lineHeight: 1.55,
          }}
        >
          Upload a spreadsheet following the coding test template.
          The <strong>Data</strong> sheet should have: <strong>B1</strong> = test title,{' '}
          <strong>D1</strong> = coding language, <strong>row 2</strong> = headers,{' '}
          <strong>row 3+</strong> = one row per test case (group rows by question; first row
          of each group fills question-level columns).
        </p>

        <button
          type="button"
          onClick={downloadCodingTestTemplate}
          style={{
            padding: '0.4rem 0.85rem',
            background: 'transparent',
            border: '1px solid var(--color-primary)',
            borderRadius: 6,
            color: 'var(--color-primary)',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          Download Template
        </button>

        <div style={{ marginBottom: '0.75rem' }}>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            disabled={uploading}
            style={{ fontSize: '0.9rem' }}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.5rem',
              background: '#ef444422',
              borderRadius: 6,
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            {error}
          </div>
        )}

        {uploading && progress && (
          <div
            style={{
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              marginBottom: '0.5rem',
            }}
          >
            {progress}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            marginTop: '1rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              color: 'var(--color-text-muted)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
