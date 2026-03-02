export interface Batch {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchMember {
  id: string;
  batchId: string;
  userId: string;
  joinedAt: Date;
  batch?: Batch;
}
