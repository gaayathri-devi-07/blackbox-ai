import { authedRoute } from "@/lib/server/api";
import { aiUsageSummary } from "@/lib/governance/audit";
import { aiStatus } from "@/lib/ai/availability";
import { tracingEnabled } from "@/lib/observability/tracing";
import { embeddingsConfigured } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/governance — how AI is used on this account (counts only, never content). */
export const GET = authedRoute(async ({ user }) => {
  const [usage, chunks] = await Promise.all([aiUsageSummary(user.id), prisma.knowledgeChunk.count()]);
  return {
    usage,
    controls: {
      piiMasking: process.env.PII_MASKING !== "off",
      auditLog: process.env.AI_AUDIT_LOG !== "off",
      tracing: tracingEnabled(),
      embeddings: embeddingsConfigured(),
      knowledgeChunks: chunks,
      ai: aiStatus().mode,
    },
  };
});
