import { z } from "zod";
import { authedRoute, parseBody } from "@/lib/server/api";
import { projectActionSchema } from "@/lib/validation";
import { AIUnavailableError, generateJson, generateText } from "@/lib/ai/gemini";
import { heuristicAnswerScore } from "@/lib/ai/interview";
import { TRACKS } from "@/lib/domain";

export const runtime = "nodejs";
export const maxDuration = 45;

const questionsSchema = z.object({
  questions: z.array(z.object({ question: z.string().min(5).max(400), focus: z.string().max(60).optional() })).min(3).max(8),
});

const FALLBACK_QUESTIONS = [
  { question: "Walk me through the architecture of this project end to end. What are the main components and how does data flow between them?", focus: "Architecture" },
  { question: "What was the most important technical decision you made, and what alternatives did you reject?", focus: "Trade-offs" },
  { question: "What was the hardest problem you hit, and how did you debug or resolve it?", focus: "Problem solving" },
  { question: "How does the system behave under ten times the load? What breaks first?", focus: "Scalability" },
  { question: "How did you verify it works — testing, evaluation or monitoring?", focus: "Quality" },
  { question: "Which parts did you personally own, and what would you redesign with hindsight?", focus: "Ownership" },
];

/** Tailored interview questions about a candidate's own project, and answer reviews. */
export const POST = authedRoute(async ({ req, user }) => {
  const body = await parseBody(req, projectActionSchema, 96 * 1024, { redact: true });
  const track = user.targetRole ? TRACKS[user.targetRole].label : "software engineering";

  if (body.action === "analyze") {
    try {
      const result = await generateJson(questionsSchema, {
        system: `You are a senior interviewer for ${track} roles who probes candidates on their own projects to verify depth and ownership.`,
        prompt: `Project description:\n"""\n${body.projectDescription.slice(0, 15_000)}\n"""\n\nWrite 6 interview questions specific to this project — architecture, key decisions and trade-offs, hardest problem, scale and failure modes, evaluation or testing, and personal ownership. Return JSON: {"questions":[{"question":"...","focus":"one or two words"}]}.`,
        temperature: 0.6,
        maxOutputTokens: 1200,
        timeoutMs: 25_000,
      });
      return { questions: result.questions, source: "model" };
    } catch (error) {
      if (!(error instanceof AIUnavailableError)) throw error;
      return { questions: FALLBACK_QUESTIONS, source: "fallback" };
    }
  }

  // action === "answer"
  try {
    const review = await generateText({
      system: `You are a senior ${track} interviewer reviewing how a candidate explains their own project. Be direct and specific.`,
      prompt: `Project context:\n"""\n${body.projectDescription.slice(0, 8_000)}\n"""\n\nQuestion: ${body.question}\nCandidate answer: ${body.answer}\n\nRespond in three short labelled paragraphs — "What works:", "What's missing:", "Stronger answer:" — under 220 words total. No markdown symbols.`,
      temperature: 0.5,
      maxOutputTokens: 900,
      timeoutMs: 25_000,
    });
    return { review, source: "model" };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    const h = heuristicAnswerScore(body.answer);
    return {
      review: `Offline rubric score: ${h.score}/100.\n\nWhat's missing: ${h.notes.join(" ") || "Add more technical depth and explicit trade-offs."}\n\nStronger answer: lead with the problem and constraints, explain the decision you made and the alternatives you rejected, then close with a measurable result and what you would change.`,
      source: "heuristic",
    };
  }
});
