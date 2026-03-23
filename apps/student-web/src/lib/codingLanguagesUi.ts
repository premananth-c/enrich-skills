import {
  CODING_LANGUAGE_IDS,
  CODING_LANGUAGE_LABELS,
  type CodingLanguageId,
} from './codingLanguages';

export { CODING_LANGUAGE_LABELS, CODING_LANGUAGE_IDS };
export type { CodingLanguageId };

export function monacoLanguageForCodingId(id: string): string {
  if (id === 'cpp' || id === 'c') return 'cpp';
  if (id === 'react' || id === 'angular' || id === 'typescript') return 'typescript';
  return id;
}

export const DEFAULT_CODE_TEMPLATES: Record<CodingLanguageId, string> = {
  python:
    '# Write your solution here\nimport sys\n\ndef solve():\n    pass\n\nsolve()\n',
  javascript:
    '// Write your solution here\nfunction solve() {\n  //\n}\n\nsolve();\n',
  typescript:
    '// Write your solution here (TypeScript 5.x)\nfunction solve(): void {\n  //\n}\n\nsolve();\n',
  react:
    '// React / TSX — use console.log or stdout as required by the problem\nfunction solve(): void {\n  //\n}\n\nsolve();\n',
  angular:
    '// TypeScript (Angular-style) — implement solve()\nfunction solve(): void {\n  //\n}\n\nsolve();\n',
  java:
    '// Write your solution here\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        //\n    }\n}\n',
  cpp:
    '// Write your solution here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    //\n    return 0;\n}\n',
  c:
    '// Write your solution here\n#include <stdio.h>\n\nint main() {\n    //\n    return 0;\n}\n',
};
