-- Run once if migrate deploy fails (P3005) but you need this column for the app to work.
-- Safe to run multiple times (IF NOT EXISTS).
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "questionOrder" JSONB;
