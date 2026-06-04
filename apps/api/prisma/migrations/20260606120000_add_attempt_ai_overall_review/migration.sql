-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN "aiOverallReview" JSONB;
ALTER TABLE "Attempt" ADD COLUMN "aiOverallReviewStatus" TEXT;
ALTER TABLE "Attempt" ADD COLUMN "aiOverallReviewError" TEXT;
ALTER TABLE "Attempt" ADD COLUMN "aiOverallReviewModel" TEXT;
ALTER TABLE "Attempt" ADD COLUMN "aiOverallReviewGeneratedAt" TIMESTAMP(3);
