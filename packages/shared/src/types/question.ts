export type QuestionType = 'coding' | 'mcq';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  tenantId: string;
  type: QuestionType;
  content: QuestionContent;
  difficulty: Difficulty;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionContent {
  title: string;
  description: string;
  examples?: { input: string; output: string }[];
  constraints?: string[];
  // MCQ specific
  options?: { id: string; text: string; isCorrect: boolean }[];
  explanation?: string;
}

export interface TestCase {
  id: string;
  questionId: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  weight: number;
}
