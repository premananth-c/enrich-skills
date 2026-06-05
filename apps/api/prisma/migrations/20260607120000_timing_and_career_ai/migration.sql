-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "codeSubmittedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "aiCareerReview" JSONB;
ALTER TABLE "User" ADD COLUMN "aiCareerReviewStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "aiCareerReviewError" TEXT;
ALTER TABLE "User" ADD COLUMN "aiCareerReviewModel" TEXT;
ALTER TABLE "User" ADD COLUMN "aiCareerReviewGeneratedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "aiCareerReviewTestCount" INTEGER;
