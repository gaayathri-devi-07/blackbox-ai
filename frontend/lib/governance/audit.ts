import "server-only";

import { prisma } from "@/lib/prisma";
import { getAiContext } from "@/lib/ai/context";
import type { PiiKind } from "@/lib/governance/pii";

export type AiOutcomeValue = "OK" | "FALLBACK" | "ERROR" | "BLOCKED";

export interface AiEventInput {
  operation: "generate" | "json" | "tts" | "transcribe" | "embed" | "tool" | "agent";
  outcome: AiOutcomeValue;
  latencyMs: number;
  model?: string | null;
  feature?: string;
  promptChars?: number;
  outputChars?: number;
  inputTokens?: number;
  outputTokens?: number;
  piiMasked?: Partial<Record<PiiKind, number>>;
  guardFlags?: string[];
  detail?: string;
}

export function auditEnabled(): boolean {
  return process.env.AI_AUDIT_LOG !== "off";
}

/**
 * Record one AI call. Fire-and-forget: auditing must never slow down or break
 * the request. Only sizes, counts and outcomes are stored — never text.
 */
export function recordAiEvent(event: AiEventInput): void {
  if (!auditEnabled()) return;
  const ctx = getAiContext();
  const pii = event.piiMasked && Object.keys(event.piiMasked).length ? event.piiMasked : undefined;
  void prisma.aiEvent
    .create({
      data: {
        userId: ctx?.userId ?? null,
        requestId: ctx?.requestId ?? null,
        feature: event.feature ?? ctx?.feature ?? "unknown",
        operation: event.operation,
        model: event.model ?? null,
        outcome: event.outcome,
        latencyMs: Math.max(0, Math.round(event.latencyMs)),
        promptChars: event.promptChars ?? 0,
        outputChars: event.outputChars ?? 0,
        inputTokens: event.inputTokens ?? null,
        outputTokens: event.outputTokens ?? null,
        piiMasked: pii,
        guardFlags: event.guardFlags ?? [],
        detail: event.detail?.slice(0, 300) ?? null,
      },
    })
    .catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") console.warn("[audit] could not record AI event:", (error as Error).message);
    });
}

/** Aggregate usage for the governance panel in Settings. */
export async function aiUsageSummary(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const events = await prisma.aiEvent.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { feature: true, outcome: true, piiMasked: true, guardFlags: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const byFeature = new Map<string, number>();
  let masked = 0;
  let flagged = 0;
  let fallback = 0;
  let live = 0;
  for (const e of events) {
    byFeature.set(e.feature, (byFeature.get(e.feature) ?? 0) + 1);
    const counts = (e.piiMasked ?? {}) as Record<string, number>;
    masked += Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
    if (e.guardFlags.length) flagged++;
    if (e.outcome === "OK") live++;
    if (e.outcome === "FALLBACK") fallback++;
  }
  return {
    days,
    calls: events.length,
    live,
    fallback,
    piiMasked: masked,
    guardFlagged: flagged,
    features: [...byFeature.entries()].sort((a, b) => b[1] - a[1]).map(([feature, count]) => ({ feature, count })),
  };
}
