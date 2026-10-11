-- CreateEnum
CREATE TYPE "AiOutcome" AS ENUM ('OK', 'FALLBACK', 'ERROR', 'BLOCKED');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('QUESTION', 'NOTE', 'COMPANY', 'GD_TOPIC');

-- CreateTable
CREATE TABLE "ai_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "feature" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gemini',
    "model" TEXT,
    "outcome" "AiOutcome" NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "prompt_chars" INTEGER NOT NULL DEFAULT 0,
    "output_chars" INTEGER NOT NULL DEFAULT 0,
    "pii_masked" JSONB,
    "guard_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "request_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "kind" "KnowledgeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "PracticeCategory",
    "role_targets" "TargetRole"[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "href" TEXT,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "embedding_model" TEXT,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    -- Keyword retrieval: title weighted above body, maintained by Postgres.
    "search" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("content", '')), 'B')
    ) STORED,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "rationale" TEXT,
    "source" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_events_user_id_created_at_idx" ON "ai_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_events_feature_created_at_idx" ON "ai_events"("feature", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_chunks_source_id_key" ON "knowledge_chunks"("source_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_kind_idx" ON "knowledge_chunks"("kind");

-- CreateIndex
CREATE INDEX "study_plans_user_id_created_at_idx" ON "study_plans"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "ai_events" ADD CONSTRAINT "ai_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Full-text index for hybrid retrieval.
CREATE INDEX "knowledge_chunks_search_idx" ON "knowledge_chunks" USING GIN ("search");
