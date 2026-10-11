import "server-only";

import { z } from "zod";
import type { User } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboard, type InterviewFeedback } from "@/lib/db";
import {
  CAREER_STAGE_LABELS,
  CATEGORY_LABELS,
  EXPERIENCE_LABELS,
  PRACTICE_CATEGORIES,
  TIMELINE_LABELS,
  TRACKS,
  type PracticeCategory,
} from "@/lib/domain";
import { AIUnavailableError, aiReachable } from "@/lib/ai/gemini";
import { retrieve } from "@/lib/rag/retrieve";
import { parseFinalJson, runAgent, tool, type AgentStep } from "@/lib/agents/runtime";

/**
 * Prep Planner agent.
 *
 * Goal: turn everything Blackbox knows about the candidate into a short,
 * concrete plan for the next few days. The agent investigates with read-only
 * tools (profile, performance, practice bank, knowledge base) and answers with
 * a JSON plan. Offline, the same tools run in a fixed order and a rule-based
 * planner writes the plan, so the feature never disappears.
 */

export const PLAN_ITEM_KINDS = ["practice", "interview", "gd", "study", "project", "review"] as const;

export const planSchema = z.object({
  headline: z.string().min(3).max(140),
  rationale: z.string().max(700),
  items: z
    .array(
      z.object({
        day: z.number().int().min(1).max(7),
        title: z.string().min(3).max(120),
        detail: z.string().max(400),
        kind: z.enum(PLAN_ITEM_KINDS),
        minutes: z.number().int().min(5).max(120),
        href: z.string().max(300).optional(),
      })
    )
    .min(3)
    .max(12),
});
export type StudyPlanContent = z.infer<typeof planSchema>;

export interface PlanResult extends StudyPlanContent {
  source: "agent" | "rules";
  steps: AgentStep[];
}

const KIND_HREF: Record<(typeof PLAN_ITEM_KINDS)[number], string> = {
  practice: "/journey/practice",
  interview: "/interview/setup",
  gd: "/gd-room",
  study: "/journey/practice",
  project: "/journey/project",
  review: "/dashboard/performance",
};

/** Only in-app links survive; anything else is replaced by the module link. */
function safeHref(href: string | undefined, kind: (typeof PLAN_ITEM_KINDS)[number]): string {
  return href && href.startsWith("/") && !href.startsWith("//") ? href : KIND_HREF[kind];
}

// ─── Tools (read-only) ────────────────────────────────────────────────────────

function profileOf(user: User) {
  return {
    name: user.name?.split(" ")[0] ?? null,
    careerStage: user.careerStage ? CAREER_STAGE_LABELS[user.careerStage].label : null,
    organization: user.organization,
    currentTitle: user.currentTitle,
    track: user.targetRole ? TRACKS[user.targetRole].label : null,
    level: user.experienceLevel ? EXPERIENCE_LABELS[user.experienceLevel].label : null,
    interviewTimeline: user.interviewTimeline ? TIMELINE_LABELS[user.interviewTimeline].label : null,
    targetCompanies: user.targetCompanies,
    goal: user.goal,
    focusTopics: user.preferredTopics.map((t) => CATEGORY_LABELS[t]),
  };
}

async function performanceOf(user: User) {
  const dash = await getDashboard(user);
  const recent = await prisma.interviewSession.findMany({
    where: { userId: user.id, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { feedback: true, company: true, score: true },
  });
  const weakAnswers = recent
    .flatMap((s) => ((s.feedback as unknown as InterviewFeedback | null)?.perAnswer ?? []).map((a) => ({ ...a, company: s.company })))
    .filter((a) => a.score < 60)
    .slice(0, 6)
    .map((a) => ({ question: a.question.slice(0, 160), score: a.score, studyTopics: a.keyPoints ?? [] }));
  return {
    readiness: dash.readiness,
    interviewAverage: dash.interviewAvg,
    groupDiscussionAverage: dash.gdAvg,
    sessions: dash.totals,
    skills: dash.skills.filter((s) => s.value !== null).map((s) => ({ skill: s.label, score: s.value })),
    practiceCoverage: dash.focus.map((f) => ({
      category: f.category,
      label: f.label,
      reviewedOrConfident: f.reviewed + f.confident,
      total: f.total,
    })),
    weakAnswers,
    daysSinceLastDiscussion: dash.recent.find((r) => r.kind === "discussion")
      ? Math.round((Date.now() - new Date(dash.recent.find((r) => r.kind === "discussion")!.at).getTime()) / 86_400_000)
      : null,
  };
}

async function practiceQuestionsFor(user: User, category: PracticeCategory, limit: number) {
  const done = await prisma.practiceProgress.findMany({ where: { userId: user.id }, select: { questionId: true } });
  const qs = await prisma.practiceQuestion.findMany({
    where: {
      category,
      id: { notIn: done.map((d) => d.questionId) },
      ...(user.targetRole ? { OR: [{ roleTargets: { has: user.targetRole } }, { roleTargets: { isEmpty: true } }] } : {}),
    },
    take: limit,
    orderBy: [{ difficulty: "asc" }, { slug: "asc" }],
    select: { question: true, difficulty: true, category: true },
  });
  return qs.map((q) => ({
    question: q.question,
    difficulty: q.difficulty,
    href: `/journey/practice?category=${q.category}&q=${encodeURIComponent(q.question.split(/\s+/).slice(0, 6).join(" ").replace(/[^\w\s-]/g, ""))}`,
  }));
}

function plannerTools(user: User) {
  return [
    tool({
      name: "get_candidate_profile",
      description: "Career stage, college or employer, target track and level, interview timeline, target companies, goal and focus topics.",
      parameters: { type: "object", properties: {} },
      args: z.object({}).passthrough(),
      run: async () => profileOf(user),
      summarize: () => "Read your profile and goals",
    }),
    tool({
      name: "get_performance_summary",
      description:
        "Readiness, interview and group-discussion averages, skill scores, practice coverage per category, and recent weak answers with the topics to study.",
      parameters: { type: "object", properties: {} },
      args: z.object({}).passthrough(),
      run: async () => performanceOf(user),
      summarize: (_a, r) => {
        const p = r as Awaited<ReturnType<typeof performanceOf>>;
        return `Reviewed your scores (readiness ${p.readiness ?? "—"}, ${p.weakAnswers.length} weak answers)`;
      },
    }),
    tool({
      name: "find_practice_questions",
      description: "Unpractised questions from the bank for one category, easiest first, with in-app links.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: PRACTICE_CATEGORIES },
          limit: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["category"],
      },
      args: z.object({ category: z.enum(PRACTICE_CATEGORIES as [PracticeCategory, ...PracticeCategory[]]), limit: z.number().int().min(1).max(5).optional() }),
      run: async (a) => practiceQuestionsFor(user, a.category, a.limit ?? 3),
      summarize: (a, r) => `Found ${(r as unknown[]).length} questions in ${CATEGORY_LABELS[a.category as PracticeCategory]}`,
    }),
    tool({
      name: "search_knowledge",
      description: "Search the study notes and model answers (RAG). Use it to choose what to study for a weak topic.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Topic or question to look up" } },
        required: ["query"],
      },
      args: z.object({ query: z.string().min(2).max(200) }),
      run: async (a) =>
        (await retrieve(a.query, { k: 3, role: user.targetRole, kinds: ["NOTE", "QUESTION", "COMPANY"] })).map((c) => ({
          title: c.title,
          excerpt: c.content.slice(0, 280),
          href: c.href,
        })),
      summarize: (a) => `Looked up “${String(a.query).slice(0, 48)}” in the study notes`,
    }),
  ];
}

// ─── Agent ────────────────────────────────────────────────────────────────────

const SYSTEM = `You are the Blackbox Prep Planner, an agent that plans interview preparation.
Investigate before planning: call get_candidate_profile and get_performance_summary first, then use find_practice_questions and search_knowledge for the weakest areas.
Then reply with ONLY a JSON object:
{"headline": one encouraging, specific sentence,
 "rationale": 2-3 sentences explaining why this plan, citing the evidence you found,
 "items": 5-8 items, each {"day": 1-7, "title", "detail" (what exactly to do and why), "kind": one of practice|interview|gd|study|project|review, "minutes": 10-60, "href": an in-app link from the tool results or "/interview/setup", "/gd-room", "/journey/practice", "/journey/project"}}.
Rules: fit the timeline (interviews this week → 3-4 days, intense; otherwise spread over 7 days); mix practice, at least one mock interview and, for campus or placement candidates, a group discussion; target the weakest skills and categories first; keep each day under 90 minutes.`;

export async function planWithAgent(user: User): Promise<PlanResult> {
  const result = await runAgent({
    name: "planner",
    system: SYSTEM,
    goal: "Plan my interview preparation for the coming days.",
    tools: plannerTools(user),
    maxSteps: 7,
  });
  const plan = parseFinalJson(planSchema, result.text);
  if (!plan) throw new AIUnavailableError("Planner returned an invalid plan.");
  return {
    ...plan,
    items: plan.items.map((i) => ({ ...i, href: safeHref(i.href, i.kind) })).sort((a, b) => a.day - b.day),
    source: "agent",
    steps: result.steps,
  };
}

// ─── Offline planner ──────────────────────────────────────────────────────────

/** Deterministic planner using the same tools, for offline mode and as a safety net. */
export async function planWithRules(user: User): Promise<PlanResult> {
  const steps: AgentStep[] = [];
  const timed = async <T,>(name: string, args: Record<string, unknown>, fn: () => Promise<T>, summary: (r: T) => string) => {
    const t = Date.now();
    const r = await fn();
    steps.push({ tool: name, args, summary: summary(r), ms: Date.now() - t, ok: true });
    return r;
  };

  const profile = await timed("get_candidate_profile", {}, async () => profileOf(user), () => "Read your profile and goals");
  const perf = await timed("get_performance_summary", {}, () => performanceOf(user), (p) => `Reviewed your scores (readiness ${p.readiness ?? "—"})`);

  const intense = user.interviewTimeline === "THIS_WEEK";
  const days = intense ? 4 : 7;
  const coverage = [...perf.practiceCoverage].sort((a, b) => a.reviewedOrConfident / Math.max(1, a.total) - b.reviewedOrConfident / Math.max(1, b.total));
  const weakCats = coverage.slice(0, 2);
  const weakestSkill = [...perf.skills].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const studyTopic = perf.weakAnswers[0]?.studyTopics[0] ?? weakCats[0]?.label ?? profile.track ?? "interview fundamentals";

  const items: StudyPlanContent["items"] = [];
  for (const [i, cat] of weakCats.entries()) {
    const qs = await timed(
      "find_practice_questions",
      { category: cat.category, limit: 2 },
      () => practiceQuestionsFor(user, cat.category as PracticeCategory, 2),
      (r) => `Found ${r.length} questions in ${cat.label}`
    );
    items.push({
      day: 1 + i * (intense ? 1 : 2),
      title: `Practise ${cat.label}`,
      detail: qs.length
        ? `Answer out loud, then compare with the model answer: “${qs[0].question.slice(0, 110)}”${qs[1] ? " and one more." : ""}`
        : `Review the ${cat.label} questions you marked as reviewed and aim to make them confident.`,
      kind: "practice",
      minutes: 30,
      href: qs[0]?.href ?? `/journey/practice?category=${cat.category}`,
    });
  }

  const notes = await timed(
    "search_knowledge",
    { query: studyTopic },
    () => retrieve(studyTopic, { k: 2, role: user.targetRole, kinds: ["NOTE", "QUESTION"] }),
    () => `Looked up “${studyTopic.slice(0, 48)}” in the study notes`
  );
  items.push({
    day: 2,
    title: `Study: ${studyTopic.length > 60 ? `${studyTopic.slice(0, 60)}…` : studyTopic}`,
    detail: notes[0] ? `${notes[0].title}. ${notes[0].content.split(/(?<=\.)\s+/)[0]}` : "Read the model answers for this topic and write a one-paragraph summary from memory.",
    kind: "study",
    minutes: 20,
    href: notes[0]?.href ?? "/journey/practice",
  });

  items.push({
    day: intense ? 2 : 3,
    title: perf.sessions.interviews ? "Coached mock interview" : "Baseline mock interview",
    detail: weakestSkill
      ? `Focus on ${weakestSkill.skill.toLowerCase()} (currently ${weakestSkill.score}). Coached mode gives feedback after every answer.`
      : "Five questions calibrated to your track. It sets your readiness baseline.",
    kind: "interview",
    minutes: 30,
    href: "/interview/setup?mode=SUPPORTIVE",
  });

  const placement = user.careerStage === "STUDENT" || user.careerStage === "RECENT_GRADUATE";
  if (placement || perf.daysSinceLastDiscussion === null || perf.daysSinceLastDiscussion > 10) {
    items.push({
      day: intense ? 3 : 4,
      title: "Group discussion round",
      detail: "Open with a framework, build on one panelist by name, and give a 30-second neutral summary at the end.",
      kind: "gd",
      minutes: 20,
      href: "/gd-room",
    });
  }

  if (user.targetCompanies.length) {
    items.push({
      day: intense ? 3 : 5,
      title: `Prepare for ${user.targetCompanies[0]}`,
      detail: `Prepare two STAR stories that show what ${user.targetCompanies[0]} values, and rehearse them out loud.`,
      kind: "study",
      minutes: 25,
      href: "/journey/practice?category=BEHAVIORAL",
    });
  }

  items.push({
    day: days,
    title: "Full mock interview and review",
    detail: "Standard mode, then compare your scores with the start of the week and note what improved.",
    kind: "review",
    minutes: 40,
    href: "/interview/setup",
  });

  return {
    headline: intense
      ? "Interviews are close — four focused days on your weakest areas."
      : `A week to lift ${weakCats[0]?.label ?? "your core areas"} and your interview delivery.`,
    rationale: [
      weakCats.length ? `Your lowest practice coverage is in ${weakCats.map((c) => c.label).join(" and ")}.` : "",
      weakestSkill ? `Your weakest interview dimension is ${weakestSkill.skill.toLowerCase()} at ${weakestSkill.score}.` : "You have no interview scores yet, so the plan starts with a baseline.",
      profile.interviewTimeline ? `Timeline: ${profile.interviewTimeline.toLowerCase()}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    items: items.sort((a, b) => a.day - b.day).slice(0, 8),
    source: "rules",
    steps,
  };
}

/** Agent when online, rules when offline or when the agent fails validation. */
export async function createStudyPlan(user: User): Promise<PlanResult> {
  if (aiReachable()) {
    try {
      return await planWithAgent(user);
    } catch (error) {
      if (!(error instanceof AIUnavailableError)) throw error;
    }
  }
  return planWithRules(user);
}
