-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isGeneral" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMember" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");
CREATE UNIQUE INDEX "Client_tenantId_name_key" ON "Client"("tenantId", "name");

-- CreateIndex
CREATE INDEX "ClientMember_clientId_idx" ON "ClientMember"("clientId");
CREATE INDEX "ClientMember_userId_idx" ON "ClientMember"("userId");
CREATE UNIQUE INDEX "ClientMember_clientId_userId_key" ON "ClientMember"("clientId", "userId");

-- Seed a "General" client for each existing tenant
INSERT INTO "Client" ("id", "tenantId", "name", "isGeneral", "isArchived", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'General', true, false, NOW(), NOW()
FROM "Tenant" t
WHERE NOT EXISTS (
    SELECT 1 FROM "Client" c WHERE c."tenantId" = t."id" AND c."isGeneral" = true
);

-- Add clientId to Batch
ALTER TABLE "Batch" ADD COLUMN "clientId" TEXT;
CREATE INDEX "Batch_clientId_idx" ON "Batch"("clientId");

-- Backfill Batch.clientId to the tenant's General client
UPDATE "Batch" b
SET "clientId" = c."id"
FROM "Client" c
WHERE c."tenantId" = b."tenantId" AND c."isGeneral" = true AND b."clientId" IS NULL;

-- Add clientId to User
ALTER TABLE "User" ADD COLUMN "clientId" TEXT;
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- Backfill User.clientId for students to the tenant's General client
UPDATE "User" u
SET "clientId" = c."id"
FROM "Client" c
WHERE c."tenantId" = u."tenantId" AND c."isGeneral" = true AND u."role" = 'student' AND u."clientId" IS NULL;

-- Add clientId to Invite
ALTER TABLE "Invite" ADD COLUMN "clientId" TEXT;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientMember" ADD CONSTRAINT "ClientMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
