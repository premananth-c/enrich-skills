import type { OutputMatchMode } from '../types/question.js';

/**
 * How to compare program stdout to expectedOutput for coding questions.
 * - exact: trimmed string equality (default).
 * - json-orderless: both sides must be valid JSON; array element order is ignored at every nesting level.
 *   Instructors should require students to print JSON, e.g. console.log(JSON.stringify(answer)).
 */
export function isOutputMatchMode(value: string): value is OutputMatchMode {
  return value === 'exact' || value === 'json-orderless';
}

/** Recursively sort array elements by canonical JSON so order-independent equality holds. */
export function normalizeJsonOrderless(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    const inner = value.map((item) => normalizeJsonOrderless(item));
    inner.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return inner;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    out[k] = normalizeJsonOrderless(obj[k]);
  }
  return out;
}

export function outputsMatch(actualRaw: string, expectedRaw: string, mode: OutputMatchMode): boolean {
  const actual = actualRaw.replace(/\r\n/g, '\n').trim();
  const expected = expectedRaw.replace(/\r\n/g, '\n').trim();
  if (mode !== 'json-orderless') {
    return actual === expected;
  }
  try {
    const a = JSON.parse(actual) as unknown;
    const e = JSON.parse(expected) as unknown;
    return (
      JSON.stringify(normalizeJsonOrderless(a)) === JSON.stringify(normalizeJsonOrderless(e))
    );
  } catch {
    return false;
  }
}
