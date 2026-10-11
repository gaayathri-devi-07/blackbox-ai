import { authedRoute, ApiError, parseBody, parseQuery } from "@/lib/server/api";
import { createGDPerformance, getOwnedGDPerformance, listGDPerformances, type GDEvaluation } from "@/lib/db";
import { evaluateDiscussion, moderatorFollowUp, pickTopic } from "@/lib/ai/gd";
import { runAgentTurn } from "@/lib/ai/gd-agent-graph";
import { gdActionSchema, gdQuerySchema, type GDTranscriptEntry } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET /api/gd?id=… → one performance; GET /api/gd → recent performances. */
export const GET = authedRoute(async ({ req, user }) => {
  const { id } = parseQuery(req, gdQuerySchema);
  if (!id) return { performances: await listGDPerformances(user.id) };

  const performance = await getOwnedGDPerformance(user.id, id);
  if (!performance) throw new ApiError(404, "NOT_FOUND", "Discussion not found.");
  return {
    performance: {
      id: performance.id,
      topic: performance.topic,
      score: performance.score,
      evaluation: performance.evaluation as GDEvaluation | null,
      transcript: performance.transcript as unknown as GDTranscriptEntry[],
      contributionCount: performance.contributionCount,
      durationSec: performance.durationSec,
      createdAt: performance.createdAt.toISOString(),
    },
  };
});

export const POST = authedRoute(async ({ req, user }) => {
  // Transcripts can be long; allow a larger body for completion only.
  const body = await parseBody(req, gdActionSchema, 256 * 1024, { redact: true });

  switch (body.action) {
    case "topic":
      return { topic: pickTopic(user.targetRole) };

    case "turn": {
      // Multi-agent turn: LangGraph listen → gather → draft → review (see lib/ai/gd-agent-graph.ts).
      const turn = await runAgentTurn(body.topic, body.agentId, body.history);
      return turn;
    }

    case "follow_up":
      return { text: await moderatorFollowUp(body.topic, body.history) };

    case "complete": {
      const evaluation = await evaluateDiscussion(body.topic, body.transcript);
      const performance = await createGDPerformance({
        userId: user.id,
        topic: body.topic,
        transcript: body.transcript,
        evaluation,
        contributionCount: body.transcript.filter((t) => t.speakerId === "user").length,
        durationSec: body.durationSec,
      });
      return { id: performance.id, evaluation };
    }
  }
});
