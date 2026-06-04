-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "aiReview" JSONB;
ALTER TABLE "Submission" ADD COLUMN "aiReviewStatus" TEXT;
ALTER TABLE "Submission" ADD COLUMN "aiReviewError" TEXT;
ALTER TABLE "Submission" ADD COLUMN "aiReviewModel" TEXT;
ALTER TABLE "Submission" ADD COLUMN "aiReviewLanguage" TEXT;
ALTER TABLE "Submission" ADD COLUMN "aiReviewGeneratedAt" TIMESTAMP(3);
