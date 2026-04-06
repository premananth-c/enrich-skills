import * as XLSX from 'xlsx';
import { CODING_LANGUAGE_IDS, CODING_LANGUAGE_LABELS, type CodingLanguageId } from './codingLanguages';

const DATA_SHEET = 'Data';
const INSTRUCTIONS_SHEET = 'Instructions';

const DATA_HEADERS = [
  'Question Title',
  'Description',
  'Difficulty',
  'Tags',
  'Constraints',
  'Example Input',
  'Example Output',
  'Time Limit (ms)',
  'Memory Limit (MB)',
  'Weight',
  'Starter Code',
  'TC Input',
  'TC Expected Output',
  'TC Is Public',
  'TC Weight',
  'TC Match Mode',
];

export function downloadCodingTestTemplate() {
  const wb = XLSX.utils.book_new();

  const instructions: string[][] = [
    ['Coding Test Template — Instructions'],
    [],
    ['HOW TO USE'],
    ['1. Go to the "Data" sheet.'],
    ['2. Fill in B1 with your Test Title (e.g. "Python Basics Test").'],
    ['3. Fill in D1 with the Coding Language ID from the list below.'],
    ['4. Starting from row 3, add one row per test case.'],
    ['   - For the FIRST test case of each question, fill in ALL columns (A through P).'],
    ['   - For ADDITIONAL test cases of the same question, leave columns A–K blank and only fill L–P.'],
    ['5. Each question MUST have at least one test case.'],
    [],
    ['SUPPORTED CODING LANGUAGES (use the ID in D1)'],
    ...CODING_LANGUAGE_IDS.map((id) => [`  ${id} — ${CODING_LANGUAGE_LABELS[id as CodingLanguageId]}`]),
    [],
    ['COLUMN REFERENCE (Data sheet, row 2 headers)'],
    ['Column', 'Field', 'Required', 'Description'],
    ['A', 'Question Title', 'Yes (first row)', 'Short title for the question (min 2 chars). Leave blank for additional test case rows.'],
    ['B', 'Description', 'Yes (first row)', 'Full problem description (min 10 chars). Supports plain text.'],
    ['C', 'Difficulty', 'Yes (first row)', 'One of: easy, medium, hard'],
    ['D', 'Tags', 'No', 'Comma-separated tags, e.g. "arrays, sorting"'],
    ['E', 'Constraints', 'No', 'Semicolon-separated constraints, e.g. "1 <= n <= 1000; Time: O(n)"'],
    ['F', 'Example Input', 'No', 'Sample input shown to the student'],
    ['G', 'Example Output', 'No', 'Sample output shown to the student'],
    ['H', 'Time Limit (ms)', 'No', 'Execution time limit in ms (1000–30000). Default: judge default.'],
    ['I', 'Memory Limit (MB)', 'No', 'Memory limit in MB (32–1024). Default: judge default.'],
    ['J', 'Weight', 'No', 'Question weight for scoring. Default: 1.'],
    ['K', 'Starter Code', 'No', 'Pre-filled code shown in the student editor (function signature / boilerplate). Helps students know the function name to implement.'],
    ['L', 'TC Input', 'Yes', 'Test case input string fed to the program.'],
    ['M', 'TC Expected Output', 'Yes', 'Expected output for the test case.'],
    ['N', 'TC Is Public', 'No', 'Y or N — whether the student sees this test case. Default: N.'],
    ['O', 'TC Weight', 'No', 'Weight of this test case (0–100). Default: 1.'],
    ['P', 'TC Match Mode', 'No', 'exact or json-orderless. Default: exact.'],
    [],
    ['EXAMPLE'],
    ['See the sample data pre-filled in the Data sheet (rows 3–6).'],
    ['Question 1 ("Two Sum") has 3 test cases → 3 rows.'],
    ['Question 2 ("Reverse String") has 1 test case → 1 row.'],
    [],
    ['NOTES'],
    ['• The test is created as a draft. Finish configuration on the admin test page.'],
    ['• All questions are created with the coding language specified in D1.'],
    ['• Row 1 is metadata (test title + language). Row 2 is headers. Data starts at row 3.'],
  ];

  const insWs = XLSX.utils.aoa_to_sheet(instructions);
  insWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, insWs, INSTRUCTIONS_SHEET);

  const dataRows: (string | number | null)[][] = [
    ['Test Title', 'My Coding Test', 'Coding Language', 'python'],
    DATA_HEADERS,
    // Sample question 1, test case 1
    [
      'Two Sum',
      'Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.',
      'easy',
      'arrays, hash-map',
      '2 <= nums.length <= 10^4; -10^9 <= nums[i] <= 10^9',
      '[2, 7, 11, 15]\n9',
      '[0, 1]',
      5000,
      256,
      1,
      'import sys\n\ndef two_sum(nums, target):\n    # Write your solution here\n    pass\n\n# Read input\nnums = list(map(int, input().split()))\ntarget = int(input())\nprint(two_sum(nums, target))',
      '[2, 7, 11, 15]\n9',
      '[0, 1]',
      'Y',
      1,
      'exact',
    ],
    // Sample question 1, test case 2
    [
      '', '', '', '', '', '', '', null, null, null, '',
      '[3, 2, 4]\n6',
      '[1, 2]',
      'N',
      1,
      'exact',
    ],
    // Sample question 1, test case 3
    [
      '', '', '', '', '', '', '', null, null, null, '',
      '[3, 3]\n6',
      '[0, 1]',
      'N',
      1,
      'exact',
    ],
    // Sample question 2, test case 1
    [
      'Reverse String',
      'Write a function that reverses a string. The input string is given as an array of characters.',
      'easy',
      'strings',
      '',
      '["h","e","l","l","o"]',
      '["o","l","l","e","h"]',
      5000,
      256,
      1,
      'import sys\n\ndef reverse_string(s):\n    # Write your solution here\n    pass\n\ns = list(input().strip())\nreverse_string(s)\nprint(s)',
      '["h","e","l","l","o"]',
      '["o","l","l","e","h"]',
      'Y',
      1,
      'exact',
    ],
  ];

  const dataWs = XLSX.utils.aoa_to_sheet(dataRows);
  dataWs['!cols'] = DATA_HEADERS.map((h) => ({
    wch: Math.max(h.length + 4, 18),
  }));
  XLSX.utils.book_append_sheet(wb, dataWs, DATA_SHEET);

  XLSX.writeFile(wb, 'coding-test-template.xlsx');
}

type ParsedCodingQuestion = {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  constraints: string[];
  examples: { input: string; output: string }[];
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
  weight: number | null;
  starterCode: string;
  testCases: {
    input: string;
    expectedOutput: string;
    isPublic: boolean;
    weight: number;
    outputMatchMode: 'exact' | 'json-orderless';
  }[];
};

export type ParsedCodingSheet = {
  testTitle: string;
  codingLanguage: string;
  questions: ParsedCodingQuestion[];
  error?: string;
};

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function parseBool(v: unknown): boolean {
  const s = norm(v).toUpperCase();
  return s === 'Y' || s === 'YES' || s === 'TRUE' || s === '1';
}

export function parseCodingTestSheet(workbook: XLSX.WorkBook): ParsedCodingSheet {
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'data') ??
    workbook.SheetNames[workbook.SheetNames.length - 1];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { testTitle: '', codingLanguage: '', questions: [], error: 'No data sheet found.' };

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];
  if (data.length < 3) {
    return {
      testTitle: '',
      codingLanguage: '',
      questions: [],
      error: 'The Data sheet needs at least 3 rows: row 1 = metadata, row 2 = headers, row 3+ = questions.',
    };
  }

  const testTitle = norm(data[0]?.[1]) || 'Imported Coding Test';
  const codingLanguage = norm(data[0]?.[3]).toLowerCase();

  if (!codingLanguage) {
    return { testTitle, codingLanguage: '', questions: [], error: 'D1 must contain the coding language (e.g. python, javascript).' };
  }
  if (!(CODING_LANGUAGE_IDS as readonly string[]).includes(codingLanguage)) {
    return {
      testTitle,
      codingLanguage,
      questions: [],
      error: `Invalid coding language "${codingLanguage}". Must be one of: ${CODING_LANGUAGE_IDS.join(', ')}`,
    };
  }

  const questions: ParsedCodingQuestion[] = [];
  let current: ParsedCodingQuestion | null = null;

  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every((c) => norm(c) === '')) continue;

    const title = norm(row[0]);
    const tcInput = norm(row[11]);
    const tcExpected = norm(row[12]);

    if (title) {
      if (current) {
        if (current.testCases.length === 0) {
          return { testTitle, codingLanguage, questions: [], error: `Question "${current.title}" (around row ${i + 1}) has no test cases.` };
        }
        questions.push(current);
      }

      const description = norm(row[1]);
      const diffRaw = norm(row[2]).toLowerCase();
      const difficulty: 'easy' | 'medium' | 'hard' =
        diffRaw === 'medium' ? 'medium' : diffRaw === 'hard' ? 'hard' : 'easy';
      const tags = norm(row[3])
        ? norm(row[3]).split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean)
        : [];
      const constraints = norm(row[4])
        ? norm(row[4]).split(/[;\n]+/).map((c) => c.trim()).filter(Boolean)
        : [];

      const exInput = norm(row[5]);
      const exOutput = norm(row[6]);
      const examples: { input: string; output: string }[] = [];
      if (exInput || exOutput) examples.push({ input: exInput, output: exOutput });

      const rawTime = row[7];
      let timeLimitMs: number | null = null;
      if (rawTime !== '' && rawTime != null) {
        const n = Number(rawTime);
        if (Number.isFinite(n) && n >= 1000 && n <= 30000) timeLimitMs = n;
      }

      const rawMem = row[8];
      let memoryLimitMb: number | null = null;
      if (rawMem !== '' && rawMem != null) {
        const n = Number(rawMem);
        if (Number.isFinite(n) && n >= 32 && n <= 1024) memoryLimitMb = n;
      }

      const rawWeight = row[9];
      let weight: number | null = null;
      if (rawWeight !== '' && rawWeight != null) {
        const n = Number(rawWeight);
        if (Number.isFinite(n) && n >= 0) weight = n;
      }

      const starterCode = norm(row[10]);

      current = { title, description, difficulty, tags, constraints, examples, timeLimitMs, memoryLimitMb, weight, starterCode, testCases: [] };
    }

    if (!current) {
      return { testTitle, codingLanguage, questions: [], error: `Row ${i + 1} has test case data but no preceding question title in column A.` };
    }

    if (tcInput || tcExpected) {
      const tcWeight = row[14] !== '' && row[14] != null ? Number(row[14]) : 1;
      const matchRaw = norm(row[15]).toLowerCase();
      const outputMatchMode: 'exact' | 'json-orderless' =
        matchRaw === 'json-orderless' ? 'json-orderless' : 'exact';

      current.testCases.push({
        input: tcInput,
        expectedOutput: tcExpected,
        isPublic: parseBool(row[13]),
        weight: Number.isFinite(tcWeight) && tcWeight >= 0 ? tcWeight : 1,
        outputMatchMode,
      });
    }
  }

  if (current) {
    if (current.testCases.length === 0) {
      return { testTitle, codingLanguage, questions: [], error: `Question "${current.title}" has no test cases.` };
    }
    questions.push(current);
  }

  if (questions.length === 0) {
    return { testTitle, codingLanguage, questions: [], error: 'No questions found. Add data starting from row 3.' };
  }

  return { testTitle, codingLanguage, questions };
}
