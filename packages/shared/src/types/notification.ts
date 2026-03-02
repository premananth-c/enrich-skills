export type NotificationType =
  | 'test_allocated'
  | 'course_assigned'
  | 'result_ready'
  | 'announcement'
  | 'assignment_due';

export interface Notification {
  id: string;
  userId: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}
