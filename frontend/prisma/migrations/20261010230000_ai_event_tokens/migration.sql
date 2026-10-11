-- Token usage per AI call, for cost and latency observability.
ALTER TABLE "ai_events" ADD COLUMN "input_tokens" INTEGER;
ALTER TABLE "ai_events" ADD COLUMN "output_tokens" INTEGER;

-- Time-window queries for P50/P95 latency and error rates.
CREATE INDEX "ai_events_created_at_idx" ON "ai_events"("created_at");
