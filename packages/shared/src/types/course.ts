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
  topics?: CourseTopic[];
}

export interface CourseTopic {
  id: string;
  chapterId: string;
  title: string;
  order: number;
  content: string | null;
  materials?: CourseMaterial[];
  activities?: CourseActivity[];
  evaluations?: CourseEvaluation[];
}

export interface CourseMaterial {
  id: string;
  topicId: string;
  type: 'pdf' | 'link';
  title: string;
  storageKey: string | null;
  url: string | null;
  order: number;
}

export interface CourseActivity {
  id: string;
  topicId: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  order: number;
}

export interface CourseEvaluation {
  id: string;
  topicId: string;
  type: string;
  title: string;
  testId: string | null;
  config: Record<string, unknown>;
  order: number;
}

export interface ActivitySubmission {
  id: string;
  activityId: string;
  userId: string;
  storageKey: string;
  fileName: string;
  fileSizeBytes: number | null;
  submittedAt: Date;
  updatedAt: Date;
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
  course?: Course;
}

