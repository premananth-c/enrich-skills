/** Keep in sync with packages/shared/src/lib/codingLanguages.ts */
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
