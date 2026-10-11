import { authedRoute, parseBody, parseQuery } from "@/lib/server/api";
import { addCoachMessage, clearCoachMessages, getPracticeQuestion, listCoachMessages } from "@/lib/db";
import { chatPostSchema, chatQuerySchema } from "@/lib/validation";
import { AIUnavailableError, generateText } from "@/lib/ai/gemini";
import { CATEGORY_LABELS, EXPERIENCE_LABELS, TRACKS } from "@/lib/domain";
import { answerWithCitations, type GroundedAnswer } from "@/lib/rag/answer";
import type { Citation } from "@/lib/rag/retrieve";

export const runtime = "nodejs";
export const maxDuration = 30;

const HISTORY_TURNS = 12;

/** GET /api/chat?questionId=… — persisted coach conversation (general or per question). */
export const GET = authedRoute(async ({ req, user }) => {
  const { questionId } = parseQuery(req, chatQuerySchema);
  const messages = await listCoachMessages(user.id, questionId);
  return { messages };
});

function sourcesFooter(citations: Citation[]): string {
  if (!citations.length) return "";
  return `\n\nSources: ${citations.map((c) => `[${c.n}] ${c.title.length > 70 ? `${c.title.slice(0, 70)}…` : c.title}`).join(" · ")}`;
}

/** Greetings and thanks don't need retrieval (or a refusal). */
const SMALL_TALK = /^\s*(hi|hello|hey|thanks|thank you|ok(ay)?|cool|great|got it|bye|good (morning|evening|night))[\s!.]*$/i;

export const POST = authedRoute(async ({ req, user }) => {
  const { message, questionId } = await parseBody(req, chatPostSchema, 16 * 1024, { redact: true });
  const question = questionId ? await getPracticeQuestion(questionId) : null;

  const history = await listCoachMessages(user.id, question?.id, HISTORY_TURNS);
  const userMessage = await addCoachMessage(user.id, "USER", message, question?.id);
  const turns = history.map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("model" as const), text: m.content }));

  const track = user.targetRole ? TRACKS[user.targetRole] : null;
  const system = [
    "You are a senior interview coach at a top technology company. You give precise, practical, honest guidance.",
    track ? `The candidate is preparing for ${track.label} interviews (${track.summary}).` : "",
    user.experienceLevel ? `Experience level: ${EXPERIENCE_LABELS[user.experienceLevel].label}.` : "",
    question
      ? `The conversation is about this ${CATEGORY_LABELS[question.category]} question: "${question.question}". When the candidate shares an answer, assess it against source [1] (the reference answer): what works, what is missing, and a tighter version.`
      : "",
    "Keep responses under 250 words. Use short paragraphs or a few hyphenated bullet points; no headings.",
  ]
    .filter(Boolean)
    .join("\n");

  let reply: string;
  if (SMALL_TALK.test(message) && !question) {
    try {
      reply = await generateText({ system, turns: [...turns, { role: "user", text: message }], temperature: 0.6, maxOutputTokens: 300, timeoutMs: 10_000, feature: "coach.chat" });
    } catch (error) {
      if (!(error instanceof AIUnavailableError)) throw error;
      reply = "Happy to help. Ask me about any interview topic, or open a practice question and share your answer for feedback.";
    }
  } else {
    // Grounded, cited answer — or an explicit "insufficient context" when the
    // knowledge base doesn't support the question.
    const answer: GroundedAnswer = await answerWithCitations({
      question: question ? `${question.question}\n\nCandidate: ${message}` : message,
      role: user.targetRole,
      system,
      history: turns,
      pinnedSource: question ? { title: `Reference answer: ${question.question}`, content: question.sampleAnswer } : undefined,
    });
    reply = answer.text + sourcesFooter(answer.citations);
  }

  const assistantMessage = await addCoachMessage(user.id, "ASSISTANT", reply, question?.id);
  return { messages: [userMessage, assistantMessage] };
});

export const DELETE = authedRoute(async ({ req, user }) => {
  const { questionId } = parseQuery(req, chatQuerySchema);
  await clearCoachMessages(user.id, questionId);
  return { ok: true };
});
