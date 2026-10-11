import { authedRoute, parseQuery } from "@/lib/server/api";
import { z } from "zod";
import { aiMetrics, isOperator } from "@/lib/observability/metrics";
import { aiStatus } from "@/lib/ai/availability";
import { tracingEnabled, tracingProject } from "@/lib/observability/tracing";
import { rerankerName } from "@/lib/rag/rerank";

export const runtime = "nodejs";

const query = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) });

/** GET /api/observability — AI latency (P50/P95), error and fallback rates, tokens. */
export const GET = authedRoute(async ({ req, user }) => {
  const { days } = parseQuery(req, query);
  const operator = isOperator(user.email);
  const metrics = await aiMetrics({ days, userId: operator ? null : user.id });
  return {
    ...metrics,
    ai: aiStatus(),
    tracing: { enabled: tracingEnabled(), project: tracingEnabled() ? tracingProject() : null },
    reranker: rerankerName(),
  };
});
