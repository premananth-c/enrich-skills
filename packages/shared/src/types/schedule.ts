export interface BatchScheduleEvent {
  id: string;
  batchId: string;
  title: string;
  startAt: Date;
  endAt: Date;
  type: string | null;
  courseId: string | null;
  location: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulerNote {
  id: string;
  batchId: string;
  date: string; // YYYY-MM-DD
  content: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchVideo {
  id: string;
  batchId: string;
  title: string;
  description: string | null;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  durationSeconds: number | null;
  order: number;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
