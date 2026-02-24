export interface Course {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseChapter {
  id: string;
  courseId: string;
  title: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseTopic {
  id: string;
  chapterId: string;
  title: string;
  order: number;
  content: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseMaterial {
  id: string;
  topicId: string;
  type: 'pdf' | 'link';
  title: string;
  storageKey: string | null;
  url: string | null;
  order: number;
  createdAt: Date;
}

export interface CourseActivity {
  id: string;
  topicId: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  order: number;
  createdAt: Date;
}

export interface CourseEvaluation {
  id: string;
  topicId: string;
  type: 'quiz' | 'test' | 'mcp';
  title: string;
  testId: string | null;
  config: Record<string, unknown>;
  order: number;
  createdAt: Date;
}

export interface CourseAssignment {
  id: string;
  tenantId: string;
  courseId: string;
  batchId: string | null;
  userId: string | null;
  assignedBy: string;
  assignedAt: Date;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
