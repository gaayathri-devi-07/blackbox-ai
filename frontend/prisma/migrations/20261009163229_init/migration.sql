-- CreateEnum
CREATE TYPE "TargetRole" AS ENUM ('AI_ENGINEER', 'ML_ENGINEER', 'BACKEND_ARCHITECT', 'FULL_STACK_DEVELOPER', 'DATA_SCIENTIST');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'STAFF');

-- CreateEnum
CREATE TYPE "PracticeCategory" AS ENUM ('LLM_ARCHITECTURES', 'MACHINE_LEARNING', 'MLOPS', 'SYSTEM_DESIGN', 'DATA_STRUCTURES', 'BACKEND_ENGINEERING', 'FRONTEND_ENGINEERING', 'DATA_ANALYTICS', 'BEHAVIORAL', 'COMMUNICATION');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('SUPPORTIVE', 'STANDARD', 'PRESSURE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PracticeStatus" AS ENUM ('REVIEWED', 'CONFIDENT');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "photo_url" TEXT,
    "target_role" "TargetRole",
    "experience_level" "ExperienceLevel",
    "preferred_topics" "PracticeCategory"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TargetRole" NOT NULL,
    "company" TEXT NOT NULL,
    "mode" "InterviewMode" NOT NULL DEFAULT 'STANDARD',
    "experience_level" "ExperienceLevel",
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "feedback" JSONB,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "metrics" JSONB,
    "answer_scores" INTEGER[],
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_performances" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "transcript" JSONB NOT NULL DEFAULT '[]',
    "evaluation" JSONB,
    "score" INTEGER,
    "contribution_count" INTEGER NOT NULL DEFAULT 0,
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gd_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_questions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "PracticeCategory" NOT NULL,
    "role_targets" "TargetRole"[],
    "difficulty" "Difficulty" NOT NULL,
    "question" TEXT NOT NULL,
    "sample_answer" TEXT NOT NULL,
    "weak_answer" TEXT,
    "explanation" TEXT,
    "tip" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "status" "PracticeStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "question_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "interview_sessions_user_id_created_at_idx" ON "interview_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "gd_performances_user_id_created_at_idx" ON "gd_performances"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "practice_questions_slug_key" ON "practice_questions"("slug");

-- CreateIndex
CREATE INDEX "practice_questions_category_difficulty_idx" ON "practice_questions"("category", "difficulty");

-- CreateIndex
CREATE INDEX "practice_questions_role_targets_idx" ON "practice_questions" USING GIN ("role_targets");

-- CreateIndex
CREATE INDEX "practice_progress_user_id_updated_at_idx" ON "practice_progress"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "practice_progress_user_id_question_id_key" ON "practice_progress"("user_id", "question_id");

-- CreateIndex
CREATE INDEX "coach_messages_user_id_created_at_idx" ON "coach_messages"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_performances" ADD CONSTRAINT "gd_performances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "practice_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
