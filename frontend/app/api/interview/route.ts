import { authedRoute, ApiError, parseBody, parseQuery } from "@/lib/server/api";
import {
  appendInterviewTurns,
  completeInterviewSession,
  createInterviewSession,
  getOwnedInterview,
  listInterviewSessions,
  type InterviewFeedback,
  type InterviewTurn,
} from "@/lib/db";
import { getCompany } from "@/lib/domain";
import {
  INTERVIEW_QUESTION_COUNT,
  answerFeedback,
  evaluateInterview,
  interviewerTurns,
  mainQuestionsAsked,
  nextTurn,
  openingTurn,
  overallScore,
  type CandidateBackground,
  type InterviewContext,
} from "@/lib/ai/interview";
import type { User } from "@/lib/generated/prisma/client";
import { interviewActionSchema, interviewQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
// Model turns have an offline fallback, but allow enough time for a slow
// provider response before the platform terminates the request.
export const maxDuration = 120;

/** The career profile fields the interviewer uses for context. */
function backgroundOf(user: User): CandidateBackground {
  return {
    careerStage: user.careerStage,
    organization: user.organization,
    currentTitle: user.currentTitle,
    graduationYear: user.graduationYear,
    targetCompanies: user.targetCompanies,
    interviewTimeline: user.interviewTimeline,
    goal: user.goal,
  };
}

/** What the client needs to present an interviewer turn. */
function presentTurn(turns: InterviewTurn[], turn: InterviewTurn) {
  return {
    question: turn.content,
    prompt: turn.prompt ?? turn.content,
    kind: turn.kind ?? "question",
    keyPoints: turn.keyPoints ?? [],
    /** Interviewer turns so far — echoed back on respond for idempotency. */
    turnNumber: interviewerTurns(turns).length,
    /** Main question number shown to the candidate. */
    questionNumber: mainQuestionsAsked(turns),
    totalQuestions: INTERVIEW_QUESTION_COUNT,
  };
}

/** GET /api/interview?id=… → one session; GET /api/interview → recent sessions. */
export const GET = authedRoute(async ({ req, user }) => {
  const { id } = parseQuery(req, interviewQuerySchema);
  if (!id) return { sessions: await listInterviewSessions(user.id) };

  const session = await getOwnedInterview(user.id, id);
  if (!session) throw new ApiError(404, "NOT_FOUND", "Interview session not found.");
  return {
    session: {
      id: session.id,
      role: session.role,
      company: session.company,
      mode: session.mode,
      experienceLevel: session.experienceLevel,
      status: session.status,
      score: session.score,
      feedback: session.feedback as InterviewFeedback | null,
      transcript: session.transcript as unknown as InterviewTurn[],
      metrics: session.metrics,
      answerScores: session.answerScores,
      durationSec: session.durationSec,
      createdAt: session.createdAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    },
  };
});

export const POST = authedRoute(async ({ req, user }) => {
  const body = await parseBody(req, interviewActionSchema, 64 * 1024, { redact: true });

  if (body.action === "start") {
    if (!user.targetRole) {
      throw new ApiError(409, "ONBOARDING_REQUIRED", "Choose a target track before starting an interview.");
    }
    const ctx: InterviewContext = {
      role: user.targetRole,
      company: getCompany(body.company),
      mode: body.mode,
      experienceLevel: body.experienceLevel ?? user.experienceLevel,
      topics: user.preferredTopics,
      background: backgroundOf(user),
      jobDescription: body.jobDescription || null,
    };
    const opening = await openingTurn(ctx);
    const session = await createInterviewSession({
      userId: user.id,
      role: ctx.role,
      company: ctx.company.id,
      mode: ctx.mode,
      experienceLevel: ctx.experienceLevel ?? undefined,
      jobDescription: ctx.jobDescription,
      firstTurn: opening.turn,
    });
    return {
      sessionId: session.id,
      ...presentTurn([opening.turn], opening.turn),
      aiAvailable: opening.source === "model",
    };
  }

  const session = await getOwnedInterview(user.id, body.sessionId);
  if (!session) throw new ApiError(404, "NOT_FOUND", "Interview session not found.");
  if (session.status !== "IN_PROGRESS") {
    throw new ApiError(409, "SESSION_CLOSED", "This interview has already ended.");
  }

  const ctx: InterviewContext = {
    role: session.role,
    company: getCompany(session.company),
    mode: session.mode,
    experienceLevel: session.experienceLevel,
    topics: user.preferredTopics,
    background: backgroundOf(user),
    jobDescription: session.jobDescription,
  };
  const transcript = session.transcript as unknown as InterviewTurn[];

  if (body.action === "respond") {
    const last = transcript[transcript.length - 1];
    const askedSoFar = interviewerTurns(transcript).length;
    // A retried or duplicated submit names a question that is no longer open.
    if (!last || last.role !== "interviewer" || body.questionNumber !== askedSoFar) {
      throw new ApiError(409, "NOT_YOUR_TURN", "An answer was already recorded for this question.");
    }

    // Claim the turn first so a duplicate submit can't append twice.
    const withAnswer: InterviewTurn[] = [
      ...transcript,
      { role: "candidate", content: body.answer, at: Date.now(), ...(body.refined ? { refined: true } : {}) },
    ];
    const claimedAt = await appendInterviewTurns(session.id, session.updatedAt, withAnswer);
    if (!claimedAt) throw new ApiError(409, "CONCURRENT_UPDATE", "This answer was already submitted.");

    // Coached mode grades every answer except a request for help (the coaching turn is the feedback).
    const [feedback, next] = await Promise.all([
      ctx.mode === "SUPPORTIVE" ? answerFeedback(ctx, last, body.answer) : Promise.resolve(null),
      nextTurn(ctx, withAnswer),
    ]);
    const showFeedback = feedback && next?.kind !== "coaching" ? feedback : null;

    const answerScores = feedback ? [...session.answerScores, feedback.score] : session.answerScores;
    const updated = next ? [...withAnswer, next] : withAnswer;
    if (next || feedback) await appendInterviewTurns(session.id, claimedAt, updated, { answerScores });

    if (!next) {
      return {
        done: true,
        question: null,
        turnNumber: askedSoFar,
        questionNumber: mainQuestionsAsked(withAnswer),
        totalQuestions: INTERVIEW_QUESTION_COUNT,
        feedback: showFeedback,
      };
    }
    return { done: false, ...presentTurn(updated, next), feedback: showFeedback };
  }

  // action === "complete"
  const feedback = await evaluateInterview(ctx, transcript, body.metrics);
  const lastTurn = transcript[transcript.length - 1];
  const finished = mainQuestionsAsked(transcript) >= INTERVIEW_QUESTION_COUNT && lastTurn?.role === "candidate";
  const score = overallScore(feedback.scores);
  await completeInterviewSession(session.id, {
    status: finished ? "COMPLETED" : "ABANDONED",
    score,
    feedback,
    metrics: body.metrics,
    answerScores: feedback.perAnswer.map((a) => a.score),
    durationSec: body.durationSec,
  });
  return { sessionId: session.id, score };
});
