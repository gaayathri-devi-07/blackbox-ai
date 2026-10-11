import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Service-level metrics for the AI layer, computed from the ai_events audit
 * table: call volume, error and fallback rates, P50/P95 latency and tokens,
 * per feature and overall. Fallback = the request was answered by the
 * rule-based/offline path because the model failed or was unavailable.
 */
export interface FeatureMetrics {
  feature: string;
  calls: number;
  errors: number;
  fallbacks: number;
  errorRate: number;
  fallbackRate: number;
  p50: number;
  p95: number;
  inputTokens: number;
  outputTokens: number;
}

interface Row {
  feature: string;
  calls: number;
  errors: number;
  fallbacks: number;
  p50: number | null;
  p95: number | null;
  input_tokens: number;
  output_tokens: number;
}

export async function aiMetrics(opts: { days?: number; userId?: string | null } = {}) {
  const days = opts.days ?? 7;
  const since = new Date(Date.now() - days * 86_400_000);
  const userId = opts.userId ?? null;
  const query = (grouped: boolean) =>
    prisma.$queryRawUnsafe<Row[]>(
      `SELECT ${grouped ? "feature" : "'all'"} AS feature,
              count(*)::int AS calls,
              sum(CASE WHEN outcome = 'ERROR' THEN 1 ELSE 0 END)::int AS errors,
              sum(CASE WHEN outcome = 'FALLBACK' THEN 1 ELSE 0 END)::int AS fallbacks,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)::int AS p50,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95,
              coalesce(sum(input_tokens), 0)::int AS input_tokens,
              coalesce(sum(output_tokens), 0)::int AS output_tokens
         FROM ai_events
        WHERE created_at >= $1 AND ($2::text IS NULL OR user_id = $2)
          AND operation IN ('generate', 'json', 'transcribe', 'tts', 'agent')
        ${grouped ? "GROUP BY feature ORDER BY calls DESC LIMIT 30" : ""}`,
      since,
      userId
    );
  const [features, total] = await Promise.all([query(true), query(false)]);
  const shape = (r: Row): FeatureMetrics => ({
    feature: r.feature,
    calls: r.calls,
    errors: r.errors,
    fallbacks: r.fallbacks,
    errorRate: r.calls ? r.errors / r.calls : 0,
    fallbackRate: r.calls ? r.fallbacks / r.calls : 0,
    p50: r.p50 ?? 0,
    p95: r.p95 ?? 0,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
  });
  return { days, scope: userId ? ("account" as const) : ("global" as const), total: total[0] ? shape(total[0]) : null, features: features.map(shape) };
}

/** Operators (ADMIN_EMAILS) see global metrics; everyone else sees their own account. */
export function isOperator(email: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== "production" && email?.endsWith("@demo.local")) return true;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && admins.includes(email.toLowerCase()));
}
