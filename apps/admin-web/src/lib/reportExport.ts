import * as XLSX from 'xlsx';
import { formatStatusLabel } from './status';
import { formatAttemptFraction, formatReportResult } from './reportDisplay';

export type ReportAttemptForExport = {
  user: { name: string; email: string };
  test: { title: string };
  attemptNumber: number;
  maxAttempts: number;
  status: string;
  result: 'passed' | 'failed' | null;
  score: number | null;
  maxScore: number | null;
  startedAt: string;
  submittedAt: string | null;
};

export function reportAttemptsToFlatRows(attempts: ReportAttemptForExport[]) {
  return attempts.map((a) => ({
    Student: a.user.name,
    Email: a.user.email,
    Test: a.test.title,
    Attempts: formatAttemptFraction(a.attemptNumber, a.maxAttempts),
    Status: formatStatusLabel(a.status),
    Result: formatReportResult(a.result),
    Score: a.score != null && a.maxScore != null ? `${a.score} / ${a.maxScore}` : '—',
    Started: new Date(a.startedAt).toLocaleString(),
    Submitted: a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—',
  }));
}

export function sanitizeReportFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'report';
}

export function downloadXlsxRows(
  rows: Record<string, string | number | null | undefined>[],
  filename: string,
  sheetName = 'Report'
) {
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function downloadXlsxWorkbook(sheets: { name: string; rows: Record<string, string | number | null | undefined>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  let appended = 0;
  for (const { name, rows } of sheets) {
    if (rows.length === 0) continue;
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    appended += 1;
  }
  if (appended === 0) return;
  const out = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}
