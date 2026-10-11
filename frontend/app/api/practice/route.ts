import { z } from "zod";
import { authedRoute, ApiError, parseBody, parseQuery } from "@/lib/server/api";
import { getPracticeQuestion, listPracticeQuestions, practiceFacets, practiceTagFacets, setPracticeProgress } from "@/lib/db";
import { practiceActionSchema, practiceQuerySchema } from "@/lib/validation";
import { AIUnavailableError, generateJson } from "@/lib/ai/gemini";
import { heuristicAnswerScore } from "@/lib/ai/interview";
import { TRACKS } from "@/lib/domain";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/practice — questions for the selected track (default: the profile's)
 * or all tracks, filtered by category, difficulty, tag, search text and
 * progress status, with cursor paging. The first page also includes
 * per-category counts and the most common tags for the filters.
 */
export const GET = authedRoute(async ({ req, user }) => {
  const query = parseQuery(req, practiceQuerySchema);
  const track = query.track ?? user.targetRole;
  const [page, facets, tags] = await Promise.all([
    listPracticeQuestions(user, query),
    query.cursor ? Promise.resolve(null) : practiceFacets(user, query.scope, query.track),
    query.cursor ? Promise.resolve(null) : practiceTagFacets(query.scope === "track" ? track : null, query.category),
  ]);
  return { ...page, facets, tags, track };
});

const attemptSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.string().max(200),
  strengths: z.array(z.string().max(300)).max(3),
  gaps: z.array(z.string().max(300)).max(3),
});

export const POST = authedRoute(async ({ req, user }) => {
  const body = await parseBody(req, practiceActionSchema, 16 * 1024, { redact: true });
  const question = await getPracticeQuestion(body.questionId);
  if (!question) throw new ApiError(404, "NOT_FOUND", "Question not found.");

  if (body.action === "progress") {
    return { status: await setPracticeProgress(user.id, question.id, body.status) };
  }

  // action === "evaluate": grade the user's own attempt against the model answer.
  let result: z.infer<typeof attemptSchema> & { source: "model" | "heuristic" };
  try {
    const graded = await generateJson(attemptSchema, {
      system: `You are a strict but constructive interviewer for ${user.targetRole ? TRACKS[user.targetRole].label : "software engineering"} roles.`,
      prompt: `Question: ${question.question}\n\nReference answer: ${question.sampleAnswer}\n\nCandidate answer: ${body.answer}\n\nGrade the candidate against the reference. Return JSON: "score" (0-100), "verdict" (one sentence), "strengths" (up to 3), "gaps" (up to 3 specific missing or incorrect points).`,
      temperature: 0.2,
      maxOutputTokens: 800,
      timeoutMs: 20_000,
    });
    result = { ...graded, score: Math.round(graded.score), source: "model" };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    const h = heuristicAnswerScore(body.answer);
    result = {
      score: h.score,
      verdict: "Scored with the offline rubric. Compare your answer with the model answer below for content accuracy.",
      strengths: h.parts.impact >= 0.5 ? ["You quantified the outcome."] : [],
      gaps: h.notes,
      source: "heuristic",
    };
  }

  const status = await setPracticeProgress(user.id, question.id, result.score >= 75 ? "CONFIDENT" : "REVIEWED");
  return { evaluation: result, status };
});
