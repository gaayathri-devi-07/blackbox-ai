-- Career profile collected during onboarding and editable in Settings.
-- CreateEnum
CREATE TYPE "CareerStage" AS ENUM ('STUDENT', 'RECENT_GRADUATE', 'WORKING_PROFESSIONAL', 'CAREER_SWITCHER', 'BETWEEN_JOBS');

-- CreateEnum
CREATE TYPE "InterviewTimeline" AS ENUM ('THIS_WEEK', 'WITHIN_MONTH', 'ONE_TO_THREE_MONTHS', 'EXPLORING');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "career_stage" "CareerStage",
ADD COLUMN     "current_title" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "graduation_year" INTEGER,
ADD COLUMN     "interview_timeline" "InterviewTimeline",
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "target_companies" TEXT[] DEFAULT ARRAY[]::TEXT[];

