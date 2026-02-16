export type TestType = 'coding' | 'mcq';
export type TestStatus = 'draft' | 'published' | 'archived';

export interface Test {
  id: string;
  tenantId: string;
  title: string;
  type: TestType;
  status: TestStatus;
  config: TestConfig;
  schedule: TestSchedule | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestConfig {
  durationMinutes: number;
  attemptLimit: number;
  shuffleQuestions: boolean;
  showResultsImmediately: boolean;
  partialScoring: boolean;
  proctoringEnabled: boolean;
  proctoringConfig?: ProctoringConfig;
  aiFeedbackEnabled: boolean;
}

export interface TestSchedule {
  startAt: Date;
  endAt: Date;
}

export interface ProctoringConfig {
  mode: 'live' | 'webcam' | 'both';
  identityCheckRequired: boolean;
  cameraMandatory: boolean;
  micRequired: boolean;
  retentionDays: number;
}
