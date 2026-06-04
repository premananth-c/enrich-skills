-- Live Meetings (introduced in schema but never captured as a migration).
-- The legacy production DB already has these tables (added there via
-- `prisma db push`); on that DB, mark this migration as applied with
-- `prisma migrate resolve --applied 20260604000000_add_live_meetings`.
-- New tenant DBs will pick it up via `prisma migrate deploy`.

-- CreateTable
CREATE TABLE "LiveMeeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'daily',
    "providerRoomId" TEXT,
    "providerRoomUrl" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "hostUserId" TEXT NOT NULL,
    "coHostUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveMeetingRecording" (
    "id" TEXT NOT NULL,
    "liveMeetingId" TEXT NOT NULL,
    "providerRecordingId" TEXT,
    "storageKey" TEXT,
    "playbackUrl" TEXT,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveMeetingRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveMeeting_tenantId_idx" ON "LiveMeeting"("tenantId");

-- CreateIndex
CREATE INDEX "LiveMeeting_batchId_idx" ON "LiveMeeting"("batchId");

-- CreateIndex
CREATE INDEX "LiveMeeting_status_idx" ON "LiveMeeting"("status");

-- CreateIndex
CREATE INDEX "LiveMeetingRecording_liveMeetingId_idx" ON "LiveMeetingRecording"("liveMeetingId");

-- AddForeignKey
ALTER TABLE "LiveMeeting" ADD CONSTRAINT "LiveMeeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMeeting" ADD CONSTRAINT "LiveMeeting_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMeeting" ADD CONSTRAINT "LiveMeeting_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveMeetingRecording" ADD CONSTRAINT "LiveMeetingRecording_liveMeetingId_fkey" FOREIGN KEY ("liveMeetingId") REFERENCES "LiveMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
