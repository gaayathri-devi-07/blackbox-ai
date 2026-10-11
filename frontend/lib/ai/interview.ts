import "server-only";

import { z } from "zod";
import {
  CAREER_STAGE_LABELS,
  CATEGORY_LABELS,
  EXPERIENCE_LABELS,
  TIMELINE_LABELS,
  MODE_LABELS,
  TRACKS,
  withArticle,
  type CareerStage,
  type CompanyProfile,
  type InterviewTimeline,
  type Difficulty,
  type ExperienceLevel,
  type InterviewMode,
  type PracticeCategory,
  type TargetRole,
} from "@/lib/domain";
import type { AnswerReview, InterviewFeedback, InterviewTurn, InterviewTurnKind } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { AIUnavailableError, aiReachable, generateJson, toSpokenText } from "@/lib/ai/gemini";
import { describeSignals, readAnswer, type AnswerSignals } from "@/lib/ai/answer-signals";
import { formatContext, retrieve, studyPointsFrom, type RetrievedChunk } from "@/lib/rag/retrieve";
import type { InterviewMetrics } from "@/lib/validation";

/**
 * The interviewer.
 *
 * Each candidate answer gets a human reaction before the next question:
 * - "I don't know" or "can you give me a hint" → the interviewer coaches with
 *   2–3 concrete pointers, notes it's worth preparing, and invites one more try.
 * - A project story → a follow-up on a concept from that project.
 * - Otherwise → a short, specific acknowledgement and the next main question.
 * Difficulty follows the candidate's experience level and focus areas.
 *
 * With Gemini configured the model writes every turn (constrained by the rules
 * above); without it the same rules run on the practice bank, so the product
 * behaves the same way offline.
 */

/** Main questions per interview. Follow-ups and coached retries are extra. */
export const INTERVIEW_QUESTION_COUNT = 5;
/** Follow-ups allowed on one main question, and across the whole interview. */
const MAX_FOLLOW_UPS_PER_QUESTION = 3;
const MAX_FOLLOW_UPS = 8;

export interface InterviewContext {
  role: TargetRole;
  company: CompanyProfile;
  mode: InterviewMode;
  experienceLevel: ExperienceLevel | null;
  /** The candidate's preferred focus areas from their profile. */
  topics?: PracticeCategory[];
  /** Career background from the profile (stage, college or company, targets, timeline). */
  background?: CandidateBackground;
  /** Job description pasted by the candidate; questions are tailored to it. */
  jobDescription?: string | null;
}

export interface CandidateBackground {
  careerStage: CareerStage | null;
  organization: string | null;
  currentTitle: string | null;
  graduationYear: number | null;
  targetCompanies: string[];
  interviewTimeline: InterviewTimeline | null;
  goal: string | null;
}

/** One-sentence summary of the candidate for the interviewer prompt. */
function describeBackground(b: CandidateBackground | undefined): string | null {
  if (!b?.careerStage) return null;
  const stage = CAREER_STAGE_LABELS[b.careerStage].label.toLowerCase();
  const parts = [
    `${stage}${b.currentTitle ? ` (${b.currentTitle})` : ""}${b.organization ? ` at ${b.organization}` : ""}${b.graduationYear ? `, graduating ${b.graduationYear}` : ""}`,
    b.targetCompanies.length ? `aiming for ${b.targetCompanies.slice(0, 5).join(", ")}` : null,
    b.interviewTimeline ? `real interviews: ${TIMELINE_LABELS[b.interviewTimeline].label.toLowerCase()}` : null,
    b.goal ? `their goal: "${b.goal.slice(0, 200)}"` : null,
  ];
  return parts.filter(Boolean).join("; ");
}

const OPENING_KEY_POINTS = [
  "Lead with your current role or most relevant project in one sentence",
  "Pick two experiences that map directly to the target role",
  "Mention one concrete, measurable result",
  "Close with why this role is the right next step — keep it to about 90 seconds",
];

const BEHAVIORAL_KEY_POINTS = [
  "Use STAR: situation, task, action, result",
  "Spend most of the time on your own actions and decisions",
  "Quantify the result and say what you learned",
  "Choose a story with real stakes or conflict, not a trivial one",
];

// ─── Conversation state ───────────────────────────────────────────────────────

export function interviewerTurns(turns: InterviewTurn[]) {
  return turns.filter((t) => t.role === "interviewer");
}

/** Main questions asked so far (the opening counts; follow-ups and retries don't). */
export function mainQuestionsAsked(turns: InterviewTurn[]): number {
  return interviewerTurns(turns).filter((t) => !t.kind || t.kind === "question").length;
}

function followUpsUsed(turns: InterviewTurn[]): number {
  return interviewerTurns(turns).filter((t) => t.kind === "followup").length;
}

/** Follow-ups asked since the current main question. */
function followUpsSinceMain(turns: InterviewTurn[]): number {
  let n = 0;
  for (const t of [...interviewerTurns(turns)].reverse()) {
    if (!t.kind || t.kind === "question") break;
    if (t.kind === "followup") n++;
  }
  return n;
}

/** The main question a follow-up or retry belongs to. */
function parentQuestion(turns: InterviewTurn[]): InterviewTurn | undefined {
  return [...interviewerTurns(turns)].reverse().find((t) => !t.kind || t.kind === "question");
}

function questionText(t: InterviewTurn): string {
  return t.prompt ?? t.content;
}

function transcriptText(turns: InterviewTurn[]): string {
  return turns.map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`).join("\n\n");
}

function levelLabel(ctx: InterviewContext) {
  return ctx.experienceLevel ? EXPERIENCE_LABELS[ctx.experienceLevel].label : "unspecified";
}

function systemPrompt(ctx: InterviewContext): string {
  const track = TRACKS[ctx.role];
  const modeRules: Record<InterviewMode, string> = {
    SUPPORTIVE: "Be warm and encouraging. When the candidate struggles, teach a little before moving on.",
    STANDARD: "Be friendly but professional, like a real interviewer at a good company.",
    PRESSURE: "Be rigorous and probing. Push on weak reasoning and ask for specifics and numbers, while staying respectful.",
  };
  return [
    `You are ${ctx.company.interviewer.name}, ${ctx.company.interviewer.title} at ${ctx.company.name}, interviewing a candidate for ${withArticle(track.label)} role. Candidate level: ${levelLabel(ctx)}.`,
    `Company style: ${ctx.company.style}`,
    describeBackground(ctx.background) ? `About the candidate: ${describeBackground(ctx.background)}. Refer to this naturally where it helps (for example their college projects or the companies they're targeting), without reciting it.` : "",
    `Cover: ${track.interviewFocus}${ctx.topics?.length ? ` The candidate especially wants practice on: ${ctx.topics.map((t) => CATEGORY_LABELS[t]).join(", ")}.` : ""}`,
    ctx.jobDescription
      ? `The candidate is preparing for this specific job. Tailor most questions to its responsibilities and required skills, the way the hiring team for it would:
"""${ctx.jobDescription.slice(0, 4000)}"""`
      : "",
    modeRules[ctx.mode],
    "You are a real person having a conversation, not reading from a list. React to what the candidate actually said before moving on. Mirror their energy: reassure someone nervous, challenge someone confident and strong.",
    "Calibrate difficulty to the candidate's level: fundamentals and reasoning for entry and junior, depth and trade-offs for mid, architecture and leadership for senior and staff.",
    "Speak naturally: short sentences, everyday words, contractions. No markdown, lists, bullet points, emojis or quotation marks. Never say you are an AI.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Practice-bank questions (offline interviewer, coaching material) ─────────

const LEVEL_DIFFICULTY: Record<ExperienceLevel, Difficulty[]> = {
  ENTRY: ["EASY", "MEDIUM"],
  JUNIOR: ["EASY", "MEDIUM"],
  MID: ["MEDIUM", "HARD"],
  SENIOR: ["HARD", "MEDIUM"],
  STAFF: ["HARD"],
};

interface BankQuestion {
  id: string;
  question: string;
  sampleAnswer: string;
  keyPoints: string[];
  explanation: string | null;
  tip: string | null;
}

/** Key points for a bank question, deriving them from its explanation when none were authored. */
function keyPointsOf(q: Pick<BankQuestion, "keyPoints" | "explanation" | "tip">): string[] {
  if (q.keyPoints.length) return q.keyPoints.slice(0, 4);
  const derived = [q.explanation, q.tip]
    .filter(Boolean)
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/\.$/, ""))
    // Skip meta-commentary about sample answers; keep statements about the topic.
    .filter((s) => s.length > 12 && !/\b(weak|strong(er)?)\s+answer\b|\binterviewers?\b/i.test(s));
  return derived.slice(0, 3);
}

/** Choose the category for main question N: focus areas first, behavioral last. */
/** Retrieve study material for a question (RAG). Never throws: grounding is best-effort. */
async function groundingFor(ctx: InterviewContext, query: string, k = 3): Promise<RetrievedChunk[]> {
  try {
    return await retrieve(query, { k, role: ctx.role, kinds: ["QUESTION", "NOTE"] });
  } catch {
    return [];
  }
}

function categoryFor(ctx: InterviewContext, index: number): PracticeCategory {
  if (index >= INTERVIEW_QUESTION_COUNT - 1) return "BEHAVIORAL";
  const focus: PracticeCategory[] = TRACKS[ctx.role].focusCategories.filter((c) => c !== "BEHAVIORAL");
  const preferred = (ctx.topics ?? []).filter((t) => focus.includes(t));
  const order = [...preferred, ...focus.filter((c) => !preferred.includes(c))];
  return order[(index - 1 + order.length) % order.length];
}

/**
 * Offline tailoring: retrieve the bank questions closest to the job description
 * (RAG over the question bank) and use them for the technical questions.
 */
async function jobDescriptionQuestion(ctx: InterviewContext, used: Set<string | undefined>, asked: Set<string>): Promise<BankQuestion | null> {
  if (!ctx.jobDescription) return null;
  const hits = await groundingFor(ctx, ctx.jobDescription.slice(0, 1500), 12).then((h) => h.filter((c) => c.kind === "QUESTION"));
  const slugs = hits.map((h) => h.sourceId.replace(/^q:/, ""));
  if (!slugs.length) return null;
  const rows = await prisma.practiceQuestion.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, question: true, sampleAnswer: true, keyPoints: true, explanation: true, tip: true },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  for (const slug of slugs) {
    const r = bySlug.get(slug);
    if (r && !used.has(r.id) && !asked.has(r.question)) return r;
  }
  return null;
}

async function bankQuestion(ctx: InterviewContext, turns: InterviewTurn[]): Promise<BankQuestion | null> {
  const used = new Set(interviewerTurns(turns).map((t) => t.ref).filter(Boolean));
  const asked = new Set(interviewerTurns(turns).map(questionText));
  const index = mainQuestionsAsked(turns);
  // Technical questions follow the job description when one was provided.
  if (index < INTERVIEW_QUESTION_COUNT - 1) {
    const tailored = await jobDescriptionQuestion(ctx, used, asked);
    if (tailored) return tailored;
  }
  const category = categoryFor(ctx, index);
  const difficulties = ctx.experienceLevel ? LEVEL_DIFFICULTY[ctx.experienceLevel] : (["MEDIUM", "EASY", "HARD"] as Difficulty[]);
  const select = { id: true, question: true, sampleAnswer: true, keyPoints: true, explanation: true, tip: true } as const;
  const roleFilter = { OR: [{ roleTargets: { has: ctx.role } }, { roleTargets: { isEmpty: true } }] };

  for (const where of [
    { category, difficulty: { in: difficulties }, ...roleFilter },
    { category, ...roleFilter },
    { category },
  ]) {
    const rows = await prisma.practiceQuestion.findMany({ where, select, take: 60 });
    const fresh = rows.filter((r) => !used.has(r.id) && !asked.has(r.question));
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)];
  }
  return null;
}

async function bankById(ids: string[]): Promise<Map<string, BankQuestion>> {
  if (!ids.length) return new Map();
  const rows = await prisma.practiceQuestion.findMany({
    where: { id: { in: ids } },
    select: { id: true, question: true, sampleAnswer: true, keyPoints: true, explanation: true, tip: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

// ─── Opening ──────────────────────────────────────────────────────────────────


/**
 * The opening line is built from the profile rather than generated: it is just
 * as personal ("I see you're from IIT Madras…") and lets the interview start
 * the instant the candidate clicks Begin, with no model round-trip.
 */
export async function openingTurn(ctx: InterviewContext): Promise<{ turn: InterviewTurn; source: "model" | "bank" }> {
  const track = TRACKS[ctx.role];
  const first = ctx.company.interviewer.name.split(" ")[0];
  const bg = ctx.background;
  const personal =
    bg?.organization && (bg.careerStage === "STUDENT" || bg.careerStage === "RECENT_GRADUATE")
      ? ` I see you're from ${bg.organization}, so I'd love to hear about the projects you've done there.`
      : bg?.organization
        ? ` I see you're currently at ${bg.organization}.`
        : "";
  const tailored = ctx.jobDescription ? " I've read the job description you shared, so we'll keep things close to that role." : "";
  const question = `To start, could you walk me through your background and the work that best prepares you for ${withArticle(track.label)} role?`;
  return {
    turn: {
      role: "interviewer",
      kind: "question",
      content: `Hi, thanks for joining. I'm ${first}, ${ctx.company.interviewer.title} here at ${ctx.company.name}. There's no rush today, so take your time with each answer.${personal}${tailored} ${question}`,
      prompt: question,
      keyPoints: OPENING_KEY_POINTS,
      at: Date.now(),
    },
    source: aiReachable() ? "model" : "bank",
  };
}

// ─── Next turn ────────────────────────────────────────────────────────────────

interface Allowed {
  coaching: boolean;
  /** The candidate offered to explain something: say yes and let them. */
  invite: boolean;
  followup: boolean;
  question: boolean;
}

function allowedMoves(turns: InterviewTurn[], signals: AnswerSignals): Allowed {
  const current = interviewerTurns(turns).at(-1);
  const stuck = signals.dontKnow || signals.asksForHelp;
  const followUpRoom = followUpsSinceMain(turns) < MAX_FOLLOW_UPS_PER_QUESTION && followUpsUsed(turns) < MAX_FOLLOW_UPS;
  const substance = signals.mentionsProject || signals.technologies.length > 0 || signals.wordCount >= 35;
  return {
    coaching: stuck && current?.kind !== "coaching",
    invite: signals.offersToElaborate && followUpRoom,
    followup: !stuck && substance && followUpRoom && current?.kind !== "coaching",
    question: mainQuestionsAsked(turns) < INTERVIEW_QUESTION_COUNT,
  };
}

const nextTurnSchema = z.object({
  kind: z.enum(["question", "followup", "coaching", "invite"]),
  reaction: z.string().max(700).default(""),
  question: z.string().min(1).max(500),
  keyPoints: z.array(z.string().min(2).max(160)).min(2).max(4),
});

/**
 * The interviewer's next turn after the candidate's latest answer, or null
 * when the interview is complete.
 */
export async function nextTurn(ctx: InterviewContext, turns: InterviewTurn[]): Promise<InterviewTurn | null> {
  const answer = turns.at(-1)?.role === "candidate" ? turns.at(-1)!.content : "";
  const signals = readAnswer(answer);
  const allowed = allowedMoves(turns, signals);
  if (!allowed.coaching && !allowed.invite && !allowed.followup && !allowed.question) return null;

  try {
    return await modelTurn(ctx, turns, signals, allowed);
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    return offlineTurn(ctx, turns, signals, allowed);
  }
}

async function modelTurn(ctx: InterviewContext, turns: InterviewTurn[], signals: AnswerSignals, allowed: Allowed): Promise<InterviewTurn | null> {
  const nextMain = mainQuestionsAsked(turns) + 1;
  const moves = [
    allowed.invite &&
      '"invite" — the candidate offered to tell you more (for example about their project). Say yes warmly and with genuine interest, then ask them to walk you through it: what problem it solved, how they built it, and the hardest part. Do not change the topic',
    allowed.coaching &&
      '"coaching" — they are stuck: reassure them in a few words, then give 2 or 3 concrete insights or a way to approach the concept in plain words, mention briefly that it is worth preparing for this role, and invite them to try again with a simpler version of the question',
    allowed.followup &&
      '"followup" — dig into what they just said like a senior engineer who is genuinely fascinated by it. Ask ONE specific question anchored in their exact words, for example: which libraries or frameworks they used and why those, the biggest bottleneck or bug and how they found it, the limitations or disadvantages of their approach, how they measured that it worked, what they would change if they rebuilt it. Never ask something generic they could answer without having done the work',
    allowed.question &&
      `"question" — acknowledge their answer specifically in one short sentence (no generic praise), then ask main question ${nextMain} of ${INTERVIEW_QUESTION_COUNT} in a new area${nextMain === INTERVIEW_QUESTION_COUNT ? " — make it the behavioral question" : ""}`,
  ].filter(Boolean);
  const guidance = allowed.invite
    ? "The candidate offered to explain — you MUST choose \"invite\"."
    : allowed.followup
      ? "Their answer has substance: prefer \"followup\" to go deeper before moving on, unless you have already explored this thread thoroughly."
      : "";

  const parent = parentQuestion(turns);
  const references = allowed.coaching && parent ? await groundingFor(ctx, questionText(parent)) : [];
  const grounding = references.length
    ? `\n\nReference notes for coaching (use them for accurate insights; do not read them out verbatim):\n${formatContext(references, 2000)}`
    : "";

  const r = await generateJson(nextTurnSchema, {
    system: systemPrompt(ctx),
    feature: "interview.turn",
    prompt: `Conversation so far:\n\n${transcriptText(turns)}\n\nWhat the last answer shows: ${describeSignals(signals)}.${grounding}\n\nChoose ONE of these moves:\n- ${moves.join("\n- ")}\n${guidance}\n\nReturn JSON: {"kind": the move, "reaction": what you say before the question — one short spoken sentence that reacts to a specific detail they said (for coaching: 2-3 short sentences with the insights), "question": ONE question of at most 30 words, asking one thing (not a list of sub-questions), "keyPoints": 3-4 short phrases naming the concepts a strong answer must cover}. This is spoken aloud in a live conversation, so keep it brief and natural.`,
    temperature: 0.75,
    // Gemini 3 models spend part of this budget on thinking; keep headroom so the JSON is never cut off.
    maxOutputTokens: 1500,
    timeoutMs: 14_000,
  });

  let move = r.kind;
  if (allowed.invite) move = "invite";
  if (!allowed[move]) move = allowed.followup ? "followup" : allowed.question ? "question" : allowed.coaching ? "coaching" : "invite";
  if (!allowed[move]) return null;
  // An accepted offer is stored as a follow-up on the same topic.
  const kind: InterviewTurnKind = move === "invite" ? "followup" : move;
  const question = toSpokenText(r.question, 500);
  const reaction = toSpokenText(r.reaction, 700);
  return {
    role: "interviewer",
    kind,
    content: reaction ? `${reaction} ${question}` : question,
    prompt: kind === "coaching" && parent ? questionText(parent) : question,
    keyPoints: r.keyPoints.map((k) => k.trim()),
    at: Date.now(),
  };
}

// ─── Offline interviewer ──────────────────────────────────────────────────────

const pick = <T,>(xs: T[], seed: number) => xs[Math.abs(seed) % xs.length];

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function spokenList(points: string[]): string {
  const p = points.slice(0, 3).map((x) => lowerFirst(x.replace(/[.;]+$/, "")));
  if (p.length === 1) return `${p[0]}.`;
  if (p.length === 2) return `first, ${p[0]}; and second, ${p[1]}.`;
  return `first, ${p[0]}; second, ${p[1]}; and third, ${p[2]}.`;
}

function acknowledgement(answer: string, seed: number, nervous: boolean): string {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const quantified = /\d/.test(answer);
  const structured = /(first|then|because|trade-?off|so that|as a result)/i.test(answer);
  // Turns advance two at a time (question + answer); mix in the answer so consecutive
  // reactions never repeat word for word.
  const n = Math.floor(seed / 2) + answer.length;
  if (nervous && words < 25) {
    return pick(
      [
        "Thanks. Take your time with these, there's no rush. In the next one, try talking me through your thinking even if you're not certain.",
        "Okay, thanks. Don't worry about getting it perfect; I'm more interested in how you reason. Let's try another one.",
        "That's alright. Just think out loud on the next one, and we'll work through it together.",
      ],
      n
    );
  }
  if (quantified && structured && words >= 15) {
    return pick(
      [
        "Nice, that's clear and well structured, and I like that you put numbers on it.",
        "Good answer. You explained the reasoning and the result, which is exactly what I look for.",
        "That's crisp. Cause, action and a measurable outcome, nicely done.",
      ],
      n
    );
  }
  if (words < 35) {
    return pick(
      [
        "Got it. In a real interview I'd want a bit more depth there, so try backing points up with an example. Let's move on.",
        "Okay. That's a start, but a concrete example would make it much stronger. Next one.",
        "Alright. You're on the right track; next time, walk me through one specific case. Let's keep going.",
        "Thanks. I'd push you for more detail in a real loop, especially the why behind it. Moving on.",
      ],
      n
    );
  }
  if (structured) {
    return pick(
      [
        "Thanks, that was easy to follow. Putting a number on the outcome would make it even stronger.",
        "Okay, good reasoning there. Let's keep going.",
        "I like how you structured that. Let's go to the next one.",
      ],
      n
    );
  }
  return pick(["Thanks for walking me through that.", "Alright, thanks, that helps.", "Okay, makes sense.", "Got it, thank you."], n);
}

const PROJECT_KEY_POINTS = [
  "The problem and who it was for",
  "Architecture and the main components",
  "The hardest technical challenge and how you solved it",
  "A measurable result or what you learned",
];

/** What a genuinely curious interviewer asks about any project, in order. */
const PROJECT_PROBES: { key: string; question: string; keyPoints: string[] }[] = [
  {
    key: "libraries",
    question: "Which libraries or frameworks did you use for the core of it, and why those rather than the alternatives?",
    keyPoints: ["Name the main libraries and what each did", "Why they fit better than the alternatives", "A trade-off you accepted by choosing them"],
  },
  {
    key: "bottleneck",
    question: "What was the biggest bottleneck or bug you ran into, and how did you track it down?",
    keyPoints: ["Describe the symptom precisely", "How you measured or debugged it", "The fix and how you confirmed it worked"],
  },
  {
    key: "limitations",
    question: "What are the limitations or disadvantages of your approach, and what would you change if you rebuilt it today?",
    keyPoints: ["Honest weaknesses: scale, accuracy, cost, maintenance", "Why you accepted them at the time", "A concrete improvement you'd make now"],
  },
  {
    key: "metrics",
    question: "How did you know it actually worked? Did you measure accuracy, latency or usage in any way?",
    keyPoints: ["The metric you chose and why", "Baseline versus result", "How you'd evaluate it more rigorously"],
  },
];

async function offlineTurn(ctx: InterviewContext, turns: InterviewTurn[], signals: AnswerSignals, allowed: Allowed): Promise<InterviewTurn | null> {
  const seed = turns.length;
  const current = interviewerTurns(turns).at(-1);
  const parent = parentQuestion(turns);
  const answer = turns.at(-1)?.content ?? "";
  const roleLabel = TRACKS[ctx.role].label;

  // Stuck → coach, then let them try again.
  if (allowed.coaching && parent) {
    let points = parent.keyPoints?.length ? parent.keyPoints : [];
    if (!points.length) points = studyPointsFrom(await groundingFor(ctx, questionText(parent)));
    if (!points.length) points = BEHAVIORAL_KEY_POINTS;
    const opener = pick(
      [
        "No problem, and honestly, saying so is better than guessing.",
        "That's okay. It's a fair thing to say in an interview.",
        "Sure, let me give you a nudge.",
      ],
      seed
    );
    const content = `${opener} A few things to think about: ${spokenList(points)} This comes up a lot in ${roleLabel} interviews, so it's worth preparing before the real thing. With that in mind, how would you approach it now? Even a rough answer is fine.`;
    return { role: "interviewer", kind: "coaching", content, prompt: questionText(parent), keyPoints: points, ref: parent.ref, at: Date.now() };
  }

  // They offered to explain something → say yes and let them.
  if (allowed.invite) {
    const yes = pick(["Yes, absolutely, I'd love to hear about it.", "Sure, please go ahead, I'm curious.", "Definitely, tell me about it."], seed);
    const prompt = signals.projectTopic
      ? `Walk me through your project on ${signals.projectTopic}: what problem it solved, how you built it, and the hardest part.`
      : "Walk me through it: what problem it solved, how you built it, and the hardest part.";
    return { role: "interviewer", kind: "followup", content: `${yes} ${prompt}`, prompt, keyPoints: PROJECT_KEY_POINTS, ref: "probe:overview", at: Date.now() };
  }

  // A project story → dig into it: a concept from the technology they named,
  // then the questions a curious interviewer asks about any real project.
  if (allowed.followup && (signals.mentionsProject || signals.technologies.length)) {
    const askedRefs = new Set(interviewerTurns(turns).map((t) => t.ref));
    const tech = signals.technologies.find((t) => !askedRefs.has(`tech:${t.key}`));
    if (tech) {
      const opener = pick(["That sounds like a solid project.", "Interesting, I'd like to dig into that a little.", "Nice. Let's go one level deeper on that."], seed);
      const content = `${opener} You mentioned ${tech.name}. ${tech.question}`;
      return { role: "interviewer", kind: "followup", content, prompt: tech.question, keyPoints: tech.keyPoints, ref: `tech:${tech.key}`, at: Date.now() };
    }
    const probe = PROJECT_PROBES.find((p) => !askedRefs.has(`probe:${p.key}`));
    if (probe) {
      const opener = pick(["Okay, that's interesting.", "Got it, thanks for walking me through that.", "Nice, I like that."], seed + probe.key.length);
      return { role: "interviewer", kind: "followup", content: `${opener} ${probe.question}`, prompt: probe.question, keyPoints: probe.keyPoints, ref: `probe:${probe.key}`, at: Date.now() };
    }
  }

  if (!allowed.question) return null;

  // Next main question, with a human reaction to the previous answer.
  let reaction: string;
  if (current?.kind === "coaching" && (signals.dontKnow || signals.asksForHelp)) {
    const first = current.keyPoints?.[0];
    reaction = `That's alright. Make a note to review ${first ? lowerFirst(first.replace(/\.$/, "")) : "this topic"} before your interview, it's worth knowing. Let's move on.`;
  } else if (current?.kind === "coaching") {
    reaction = "That's much better, you used the hints well. Let's move on.";
  } else {
    reaction = acknowledgement(answer, seed, signals.seemsNervous);
  }

  const q = await bankQuestion(ctx, turns);
  const isLast = mainQuestionsAsked(turns) + 1 >= INTERVIEW_QUESTION_COUNT;
  if (!q) {
    const fallback = "Tell me about the most technically challenging problem you've solved recently, and how you approached it.";
    return { role: "interviewer", kind: "question", content: `${reaction} ${fallback}`, prompt: fallback, keyPoints: BEHAVIORAL_KEY_POINTS, at: Date.now() };
  }
  const lead = isLast ? "For my last question, " : pick(["Next, ", "Let's switch gears. ", "Okay, ", ""], seed + 1);
  // Lowercase only when the lead flows into the question ("Next, what is…").
  const spokenQ = lead.endsWith(", ") ? `${lead}${lowerFirst(q.question)}` : `${lead}${q.question}`;
  return {
    role: "interviewer",
    kind: "question",
    content: `${reaction} ${spokenQ}`,
    prompt: q.question,
    keyPoints: keyPointsOf(q),
    ref: q.id,
    at: Date.now(),
  };
}

// ─── Per-answer feedback (coached mode) ───────────────────────────────────────

const answerFeedbackSchema = z.object({
  score: z.number().min(0).max(100),
  idealAnswer: z.string().min(1).max(1500),
  corrections: z.array(z.string().max(300)).max(4).default([]),
  tip: z.string().max(400),
  keyPoints: z.array(z.string().max(160)).max(4).default([]),
});
export type AnswerFeedback = z.infer<typeof answerFeedbackSchema> & { source: "model" | "heuristic" };

export async function answerFeedback(ctx: InterviewContext, question: InterviewTurn, answer: string): Promise<AnswerFeedback> {
  const signals = readAnswer(answer);
  const references = await groundingFor(ctx, questionText(question));
  try {
    const result = await generateJson(answerFeedbackSchema, {
      feature: "interview.feedback",
      system: `You are an expert interview coach for ${TRACKS[ctx.role].label} candidates at ${levelLabel(ctx)} level. Grade honestly against a strong hiring bar, and teach.`,
      prompt: `Question: ${questionText(question)}\n\nCandidate answer: ${answer}${
        references.length ? `\n\nReference material (ground the ideal answer and key points in it when relevant):\n${formatContext(references, 2500)}` : ""
      }\n\nReturn JSON: "score" (0-100 on correctness, specificity, structure and impact; under 20 if they did not attempt it), "idealAnswer" (a strong answer in 3-5 sentences), "corrections" (0-4 short, concrete fixes), "tip" (one actionable sentence), "keyPoints" (3-4 short phrases naming the concepts to study for this question).`,
      temperature: 0.3,
      maxOutputTokens: 1000,
      timeoutMs: 20_000,
    });
    return { ...result, score: Math.round(result.score), keyPoints: result.keyPoints.length ? result.keyPoints : (question.keyPoints ?? []), source: "model" };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    const bank = question.ref && !question.ref.startsWith("tech:") ? (await bankById([question.ref])).get(question.ref) : undefined;
    const graded = gradeOffline(answer, signals);
    const retrievedAnswer = references.find((r) => r.kind === "QUESTION")?.content.match(/^Strong answer: ([^\n]+)/)?.[1];
    return {
      score: graded.score,
      idealAnswer: bank?.sampleAnswer ?? retrievedAnswer ?? genericIdeal(question),
      corrections: graded.notes,
      tip: bank?.tip ?? graded.notes[0] ?? "Anchor the answer in one concrete example with a measurable outcome.",
      keyPoints: question.keyPoints?.length ? question.keyPoints : studyPointsFrom(references),
      source: "heuristic",
    };
  }
}

function genericIdeal(question: InterviewTurn): string {
  if (/background|introduce yourself|walk me through your/i.test(questionText(question))) {
    return "In about ninety seconds: who you are professionally, two experiences that map directly to this role with one measurable result, and why this role is the logical next step.";
  }
  if (question.keyPoints?.length) {
    return `A strong answer covers ${question.keyPoints.map((k) => lowerFirst(k.replace(/\.$/, ""))).join("; ")} — and ties each point to a concrete example from your own work.`;
  }
  return "State the context in one sentence, explain what you did and the trade-offs you weighed, and close with a measurable result and what you learned.";
}

// ─── Heuristic rubric (used when the model is unavailable) ────────────────────

const STRUCTURE_MARKERS = /\b(first|second|third|then|finally|because|so that|which meant|as a result|trade-?off|instead)\b/gi;
const IMPACT_MARKERS = /(\d+(\.\d+)?\s?(%|percent|x|ms|seconds|minutes|hours|days|weeks|users|requests))|\b(reduced|increased|improved|cut|saved|grew|dropped)\b/gi;
const OWNERSHIP_MARKERS = /\b(I (led|built|designed|owned|decided|proposed|wrote|implemented|drove))\b/gi;
const FILLERS = /\b(um+|uh+|like|you know|basically|literally|kind of|sort of)\b/gi;

export function heuristicAnswerScore(answer: string): { score: number; notes: string[]; parts: Record<string, number> } {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  const structure = Math.min(1, (answer.match(STRUCTURE_MARKERS)?.length ?? 0) / 4);
  const impact = Math.min(1, (answer.match(IMPACT_MARKERS)?.length ?? 0) / 2);
  const ownership = Math.min(1, (answer.match(OWNERSHIP_MARKERS)?.length ?? 0) / 2);
  const fillerRate = (answer.match(FILLERS)?.length ?? 0) / Math.max(1, n);
  // Best between ~90 and ~260 words for a spoken answer.
  const length = n < 25 ? (n / 25) * 0.4 : n < 90 ? 0.4 + ((n - 25) / 65) * 0.6 : n <= 260 ? 1 : Math.max(0.6, 1 - (n - 260) / 400);

  const raw = 30 + length * 30 + structure * 15 + impact * 15 + ownership * 10 - Math.min(10, fillerRate * 200);
  const score = Math.max(15, Math.min(92, Math.round(raw)));

  const notes: string[] = [];
  if (n < 60) notes.push("Develop the answer further — aim for roughly 90 to 250 words with a concrete example.");
  if (impact < 0.5) notes.push("Quantify the outcome: latency, cost, accuracy, users or time saved.");
  if (structure < 0.5) notes.push("Signpost your structure (context, approach, trade-offs, result) so it is easy to follow.");
  if (ownership < 0.5) notes.push("Make your personal contribution explicit — say what you decided and built.");
  if (fillerRate > 0.03) notes.push("Reduce filler words; a brief pause reads as more confident.");

  return { score, notes: notes.slice(0, 3), parts: { length, structure, impact, ownership } };
}

function gradeOffline(answer: string, signals: AnswerSignals) {
  const h = heuristicAnswerScore(answer);
  if (signals.dontKnow || signals.asksForHelp) {
    return {
      ...h,
      score: Math.min(h.score, 12),
      notes: ["You didn't attempt this one. Study the key points below, then practise answering it out loud.", ...h.notes.slice(0, 1)],
    };
  }
  return h;
}

// ─── Final evaluation ─────────────────────────────────────────────────────────

const evaluationSchema = z.object({
  summary: z.string().min(1).max(1200),
  verdict: z.enum(["Ready", "Almost ready", "Needs more preparation"]),
  scores: z.object({
    technicalDepth: z.number().min(0).max(100),
    problemSolving: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    structure: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
  }),
  strengths: z.array(z.string().max(300)).min(1).max(4),
  improvements: z.array(z.string().max(300)).min(1).max(4),
  nextSteps: z.array(z.string().max(300)).min(1).max(4),
  perAnswer: z
    .array(
      z.object({
        score: z.number().min(0).max(100),
        idealAnswer: z.string().max(1500),
        note: z.string().max(300).optional(),
        keyPoints: z.array(z.string().max(160)).max(4).default([]),
      })
    )
    .max(12),
});

interface QAPair {
  turn: InterviewTurn;
  question: string;
  answer: string;
}

function qaPairs(turns: InterviewTurn[]): QAPair[] {
  const pairs: QAPair[] = [];
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role === "interviewer" && turns[i + 1]?.role === "candidate") {
      pairs.push({ turn: turns[i], question: questionText(turns[i]), answer: turns[i + 1].content });
    }
  }
  return pairs;
}

export function overallScore(scores: InterviewFeedback["scores"]): number {
  const s = scores;
  return Math.round(s.technicalDepth * 0.3 + s.problemSolving * 0.25 + s.communication * 0.2 + s.structure * 0.15 + s.confidence * 0.1);
}

export async function evaluateInterview(ctx: InterviewContext, turns: InterviewTurn[], metrics: InterviewMetrics): Promise<InterviewFeedback> {
  const pairs = qaPairs(turns);
  if (!pairs.length) {
    return {
      summary: "The session ended before any answers were recorded, so there is nothing to assess yet.",
      verdict: "Needs more preparation",
      scores: { technicalDepth: 0, problemSolving: 0, communication: 0, structure: 0, confidence: 0 },
      strengths: ["You set up a session — complete one end to end to get a full assessment."],
      improvements: ["Answer at least three questions so the evaluation has evidence to work with."],
      nextSteps: ["Start a coached session to get feedback after each answer."],
      perAnswer: [],
      source: "heuristic",
    };
  }

  const track = TRACKS[ctx.role];
  const delivery = [
    metrics.eyeContact != null ? `eye contact ${metrics.eyeContact}% of camera time` : null,
    metrics.posture != null ? `upright posture ${metrics.posture}% of the time` : null,
    metrics.fillerWords != null ? `${metrics.fillerWords} filler words` : null,
  ]
    .filter(Boolean)
    .join(", ");
  try {
    const result = await generateJson(evaluationSchema, {
      feature: "interview.evaluate",
      system: `You are a hiring committee member evaluating ${withArticle(track.label)} mock interview at ${ctx.company.name} for a ${levelLabel(ctx)} candidate. Be specific, evidence-based, honest and genuinely helpful. Competencies for this track: ${track.competencies.join(", ")}.`,
      prompt: `Transcript:\n\n${transcriptText(turns)}\n\nMeasured delivery: ${delivery || "not measured"}.\n\nReturn JSON: "summary" (2-3 sentences), "verdict" ("Ready", "Almost ready" or "Needs more preparation"), "scores" with technicalDepth, problemSolving, communication, structure, confidence (0-100 each), "strengths" (2-3 specific items citing what the candidate said), "improvements" (2-3 specific items), "nextSteps" (3 concrete practice actions), and "perAnswer" with exactly ${pairs.length} entries, one per candidate answer in order: score (0-100; under 20 if they did not attempt it), idealAnswer (3-4 sentences), note (one sentence on the biggest gap), keyPoints (3-4 short phrases naming the concepts to study so they can answer it next time).`,
      temperature: 0.3,
      maxOutputTokens: 4000,
      timeoutMs: 40_000,
    });
    return {
      summary: result.summary,
      verdict: result.verdict,
      scores: roundScores(result.scores),
      strengths: result.strengths,
      improvements: result.improvements,
      nextSteps: result.nextSteps,
      perAnswer: pairs.map((p, i): AnswerReview => {
        const r = result.perAnswer[i];
        const signals = readAnswer(p.answer);
        return {
          question: p.question,
          answer: p.answer,
          score: Math.round(r?.score ?? 0),
          idealAnswer: r?.idealAnswer ?? "",
          note: r?.note,
          keyPoints: r?.keyPoints?.length ? r.keyPoints : (p.turn.keyPoints ?? []),
          kind: p.turn.kind,
          attempted: !(signals.dontKnow || signals.asksForHelp),
        };
      }),
      source: "model",
    };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    return heuristicEvaluation(pairs, metrics, ctx);
  }
}

function roundScores(s: InterviewFeedback["scores"]): InterviewFeedback["scores"] {
  return {
    technicalDepth: Math.round(s.technicalDepth),
    problemSolving: Math.round(s.problemSolving),
    communication: Math.round(s.communication),
    structure: Math.round(s.structure),
    confidence: Math.round(s.confidence),
  };
}

async function heuristicEvaluation(pairs: QAPair[], metrics: InterviewMetrics, ctx: InterviewContext): Promise<InterviewFeedback> {
  const bank = await bankById(pairs.map((p) => p.turn.ref).filter((r): r is string => Boolean(r && !r.startsWith("tech:"))));
  const graded = pairs.map((p) => {
    const signals = readAnswer(p.answer);
    return { ...p, signals, ...gradeOffline(p.answer, signals) };
  });
  const mean = (f: (g: (typeof graded)[number]) => number) => graded.reduce((a, g) => a + f(g), 0) / graded.length;
  const mainAnswered = graded.filter((g) => !g.turn.kind || g.turn.kind === "question").length;
  const completion = Math.min(1, mainAnswered / INTERVIEW_QUESTION_COUNT);
  const base = mean((g) => g.score);
  const fillerPenalty = Math.min(12, ((metrics.fillerWords ?? 0) / Math.max(1, pairs.length)) * 1.5);
  const delivery = [metrics.eyeContact, metrics.posture].filter((x): x is number => x != null);

  const scores = roundScores({
    technicalDepth: base * (0.75 + 0.25 * completion),
    problemSolving: 25 + mean((g) => g.parts.structure) * 35 + mean((g) => g.parts.length) * 30,
    communication: Math.max(10, base + 4 - fillerPenalty),
    structure: 30 + mean((g) => g.parts.structure) * 60,
    confidence: Math.max(10, Math.min(95, (delivery.length ? delivery.reduce((a, b) => a + b, 0) / delivery.length : 60) - fillerPenalty / 2)),
  });
  const total = overallScore(scores);
  const notes = [...new Set(graded.flatMap((g) => g.notes))];
  const skipped = graded.filter((g) => g.signals.dontKnow || g.signals.asksForHelp);
  const followUps = graded.filter((g) => g.turn.kind === "followup").length;

  return {
    summary: `You answered ${mainAnswered} of ${INTERVIEW_QUESTION_COUNT} main questions${followUps ? ` and ${followUps} follow-up${followUps > 1 ? "s" : ""} on your own projects` : ""} for the ${TRACKS[ctx.role].label} track.${skipped.length ? ` ${skipped.length} question${skipped.length > 1 ? "s" : ""} need preparation — the key points under each one show exactly what to study.` : ""} Scored with the offline rubric (length, structure, quantified impact, ownership and measured delivery); connect Gemini for model grading.`,
    verdict: total >= 80 ? "Ready" : total >= 65 ? "Almost ready" : "Needs more preparation",
    scores,
    strengths: [
      mean((g) => g.parts.impact) >= 0.5 ? "You backed claims with measurable outcomes." : "You engaged with every question you were asked.",
      mean((g) => g.parts.structure) >= 0.5 ? "Your answers followed a clear, signposted structure." : "You kept answers focused on the question.",
    ],
    improvements: skipped.length
      ? [`Prepare the concepts behind: ${skipped.map((s) => `"${s.question.slice(0, 70)}${s.question.length > 70 ? "…" : ""}"`).join(", ")}.`, ...notes.slice(0, 2)]
      : notes.length
        ? notes.slice(0, 3)
        : ["Push for deeper technical detail and explicit trade-offs."],
    nextSteps: [
      `Review the ${TRACKS[ctx.role].focusCategories.slice(0, 2).map((c) => CATEGORY_LABELS[c]).join(" and ")} questions in the Practice Hub.`,
      "Rehearse three STAR stories with a quantified result for each.",
      "Run a coached session to get feedback after every answer.",
    ],
    perAnswer: graded.map((g): AnswerReview => {
      const b = g.turn.ref ? bank.get(g.turn.ref) : undefined;
      return {
        question: g.question,
        answer: g.answer,
        score: g.score,
        idealAnswer: b?.sampleAnswer ?? genericIdeal(g.turn),
        note: g.notes[0],
        keyPoints: g.turn.keyPoints?.length ? g.turn.keyPoints : b ? keyPointsOf(b) : [],
        kind: g.turn.kind,
        attempted: !(g.signals.dontKnow || g.signals.asksForHelp),
      };
    }),
    source: "heuristic",
  };
}

export { MODE_LABELS };
