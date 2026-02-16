export type UserRole = 'student' | 'admin' | 'proctor' | 'content_author' | 'platform_operator';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  cohortIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
