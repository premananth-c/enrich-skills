import * as XLSX from 'xlsx';

/** Column header must be exactly `Email` (case-insensitive). */
export function parseEmailsFromSpreadsheetBuffer(buf: ArrayBuffer): { emails: string[]; error?: string } {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { emails: [], error: 'The file has no sheets' };
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) return { emails: [], error: 'Sheet is empty' };
  const headers = Object.keys(rows[0] as object);
  const emailKey = headers.find((h) => String(h).trim().toLowerCase() === 'email');
  if (!emailKey) return { emails: [], error: 'No column header named "Email" found' };
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const row of rows) {
    const raw = row[emailKey];
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    emails.push(s);
  }
  if (emails.length === 0) return { emails: [], error: 'No valid email addresses in the Email column' };
  return { emails };
}
