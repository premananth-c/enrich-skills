/** Runtime / judge ids (must match services/judge LANGUAGE_CONFIG keys). */
export const CODING_LANGUAGE_IDS = [
  'python',
  'javascript',
  'typescript',
  'react',
  'angular',
  'java',
  'cpp',
  'c',
] as const;

export type CodingLanguageId = (typeof CODING_LANGUAGE_IDS)[number];

/** Human-readable labels; versions align with judge Docker images where applicable. */
export const CODING_LANGUAGE_LABELS: Record<CodingLanguageId, string> = {
  python: 'Python 3.12',
  javascript: 'JavaScript (Node.js 22)',
  typescript: 'TypeScript 5.x (Node.js 22)',
  react: 'React 19 (TypeScript / TSX, Node.js 22)',
  angular: 'Angular 19 (TypeScript, Node.js 22)',
  java: 'Java 21',
  cpp: 'C++17',
  c: 'C17',
};

export function isCodingLanguageId(value: string): value is CodingLanguageId {
  return (CODING_LANGUAGE_IDS as readonly string[]).includes(value);
}
