export type AttemptStatus = 'in_progress' | 'submitted' | 'graded';

export interface Attempt {
  id: string;
  userId: string;
  testId: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  maxScore: number | null;
  status: AttemptStatus;
}

export interface Submission {
  id: string;
  attemptId: string;
  questionId: string;
  code?: string;
  language?: string;
  selectedOptionId?: string; // MCQ
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
}

export interface AIRatings {
  codeQuality?: number;
  problemSolving?: number;
  efficiency?: number;
  correctness?: number;
}
