-- Multi-client assignment for students and invites
ALTER TABLE "User" ADD COLUMN "clientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Invite" ADD COLUMN "clientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from existing single clientId
UPDATE "User" SET "clientIds" = ARRAY["clientId"]::TEXT[] WHERE "clientId" IS NOT NULL AND cardinality("clientIds") = 0;
UPDATE "Invite" SET "clientIds" = ARRAY["clientId"]::TEXT[] WHERE "clientId" IS NOT NULL AND cardinality("clientIds") = 0;
