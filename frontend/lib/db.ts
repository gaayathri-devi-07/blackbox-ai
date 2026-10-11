import "server-only";

import type { Prisma, User } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { redact, redactDeep } from "@/lib/governance/pii-masker";
import {
  CATEGORY_LABELS,
  PRACTICE_CATEGORIES,
  TRACKS,
  type ModuleId,
  type PracticeCategory,
  type TargetRole,
} from "@/lib/domain";
import type { InterviewMetrics, PracticeQuery, ProfileUpdate } from "@/lib/validation";
import type { GDTranscriptEntry } from "@/lib/validation";

// ─── Shared JSON shapes stored in Json columns ────────────────────────────────

export type InterviewTurnKind = "question" | "followup" | "coaching";

export interface InterviewTurn {
  role: "interviewer" | "candidate";
  /** Exactly what was said aloud (an interviewer turn may add a reaction or hints). */
  content: string;
  at: number;
  /** Interviewer turns: the bare question being asked. */
  prompt?: string;
  /** Interviewer turns: a main question, a follow-up on the last answer, or a coached second attempt. */
  kind?: InterviewTurnKind;
  /** Interviewer turns: the concepts a strong answer relies on. */
  keyPoints?: string[];
  /** Interviewer turns: the practice-bank question this came from. */
  ref?: string;
  /** Candidate turns: the transcript was refined by server-side transcription. */
  refined?: boolean;
}

export interface AnswerReview {
  question: string;
  answer: string;
  score: number;
  idealAnswer: string;
  note?: string;
  /** Concepts to study before answering this question again. */
  keyPoints?: string[];
  kind?: InterviewTurnKind;
  /** False when the candidate said they didn't know. */
  attempted?: boolean;
}

export interface InterviewFeedback {
  summary: string;
  verdict: "Ready" | "Almost ready" | "Needs more preparation";
  scores: {
    technicalDepth: number;
    problemSolving: number;
    communication: number;
    structure: number;
    confidence: number;
  };
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  perAnswer: AnswerReview[];
  source: "model" | "heuristic";
}

export interface GDEvaluation {
  score: number;
  summary: string;
  dimensions: { clarity: number; relevance: number; collaboration: number; initiative: number };
  strengths: string[];
  improvements: string[];
  source: "model" | "heuristic";
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function serializeProfile(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    photoUrl: user.photoUrl,
    targetRole: user.targetRole,
    experienceLevel: user.experienceLevel,
    preferredTopics: user.preferredTopics,
    careerStage: user.careerStage,
    organization: user.organization,
    currentTitle: user.currentTitle,
    graduationYear: user.graduationYear,
    targetCompanies: user.targetCompanies,
    interviewTimeline: user.interviewTimeline,
    goal: user.goal,
    // Career stage is asked first in onboarding; accounts created before it was added see that step once.
    onboardingComplete: user.targetRole !== null && user.experienceLevel !== null && user.careerStage !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
export type Profile = ReturnType<typeof serializeProfile>;

export async function updateUserProfile(userId: string, data: ProfileUpdate): Promise<User> {
  // Free-text profile fields are redacted like any other user-written text.
  const clean = { ...data, ...(typeof data.goal === "string" ? { goal: redact(data.goal) } : {}) };
  return prisma.user.update({ where: { id: userId }, data: clean });
}

/**
 * Permanently removes the user and, through cascading foreign keys, every
 * interview, discussion, practice record and coach message they own. Signing
 * in again later provisions a fresh, empty account.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

// ─── Practice questions ───────────────────────────────────────────────────────

/** Questions for a track: those targeted at it plus track-agnostic ones. */
/**
 * Questions for a track: those targeted at it, those for every track, and every
 * question in the track's focus categories — so each focus section offers the
 * full 50-question set for that area.
 */
export function trackFilter(role: TargetRole | null): Prisma.PracticeQuestionWhereInput {
  if (!role) return {};
  return {
    OR: [{ roleTargets: { has: role } }, { roleTargets: { isEmpty: true } }, { category: { in: TRACKS[role].focusCategories } }],
  };
}

/** The track a Practice Hub request is about: an explicit choice, else the profile's. */
function practiceTrack(user: User, query: { track?: TargetRole }): TargetRole | null {
  return query.track ?? user.targetRole;
}

export async function listPracticeQuestions(user: User, query: PracticeQuery) {
  const and: Prisma.PracticeQuestionWhereInput[] = [];
  if (query.scope === "track") and.push(trackFilter(practiceTrack(user, query)));
  if (query.category) and.push({ category: query.category });
  if (query.difficulty) and.push({ difficulty: query.difficulty });
  if (query.tag) and.push({ tags: { has: query.tag } });
  if (query.q) {
    and.push({
      OR: [
        { question: { contains: query.q, mode: "insensitive" } },
        { tags: { has: query.q.toLowerCase() } },
      ],
    });
  }
  if (query.status === "new") and.push({ progress: { none: { userId: user.id } } });
  if (query.status === "reviewed") and.push({ progress: { some: { userId: user.id, status: "REVIEWED" } } });
  if (query.status === "confident") and.push({ progress: { some: { userId: user.id, status: "CONFIDENT" } } });

  const where: Prisma.PracticeQuestionWhereInput = and.length ? { AND: and } : {};

  const rows = await prisma.practiceQuestion.findMany({
    where,
    orderBy: [{ category: "asc" }, { difficulty: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: { progress: { where: { userId: user.id }, select: { status: true } } },
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    questions: page.map((q) => ({
      id: q.id,
      slug: q.slug,
      category: q.category,
      roleTargets: q.roleTargets,
      difficulty: q.difficulty,
      question: q.question,
      sampleAnswer: q.sampleAnswer,
      weakAnswer: q.weakAnswer,
      explanation: q.explanation,
      tip: q.tip,
      keyPoints: q.keyPoints,
      tags: q.tags,
      status: q.progress[0]?.status ?? null,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/** Per-category totals and the user's progress, for the track (or everything). */
export async function practiceFacets(user: User, scope: "track" | "all", track?: TargetRole) {
  const where = scope === "track" ? trackFilter(track ?? user.targetRole) : {};
  const [totals, progress] = await Promise.all([
    prisma.practiceQuestion.groupBy({ by: ["category"], where, _count: { _all: true } }),
    prisma.practiceProgress.findMany({
      where: { userId: user.id, question: where },
      select: { status: true, question: { select: { category: true } } },
    }),
  ]);

  return PRACTICE_CATEGORIES.map((category) => {
    const total = totals.find((t) => t.category === category)?._count._all ?? 0;
    const mine = progress.filter((p) => p.question.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      total,
      reviewed: mine.filter((p) => p.status === "REVIEWED").length,
      confident: mine.filter((p) => p.status === "CONFIDENT").length,
    };
  }).filter((f) => f.total > 0);
}

/** Most common tags in the current track (and category), for the tag filter. */
export async function practiceTagFacets(role: TargetRole | null, category?: PracticeCategory, limit = 24) {
  const focus = role ? TRACKS[role].focusCategories : [];
  const rows = await prisma.$queryRawUnsafe<{ tag: string; n: number }[]>(
    `SELECT t AS tag, count(*)::int AS n
       FROM practice_questions, unnest(tags) t
      WHERE ($1::text IS NULL OR $1 = ANY(role_targets::text[]) OR cardinality(role_targets) = 0 OR category::text = ANY($2::text[]))
        AND ($3::text IS NULL OR category::text = $3)
      GROUP BY t ORDER BY n DESC, t ASC LIMIT $4`,
    role,
    focus,
    category ?? null,
    limit
  );
  return rows.map((r) => ({ tag: r.tag, count: r.n }));
}

export async function getPracticeQuestion(questionId: string) {
  return prisma.practiceQuestion.findUnique({ where: { id: questionId } });
}

export async function setPracticeProgress(userId: string, questionId: string, status: "REVIEWED" | "CONFIDENT" | null) {
  if (status === null) {
    await prisma.practiceProgress.deleteMany({ where: { userId, questionId } });
    return null;
  }
  const row = await prisma.practiceProgress.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, status },
    update: { status },
  });
  return row.status;
}

// ─── Coach messages ───────────────────────────────────────────────────────────

export async function listCoachMessages(userId: string, questionId?: string, take = 30) {
  const rows = await prisma.coachMessage.findMany({
    where: { userId, questionId: questionId ?? null },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return rows.reverse();
}

export async function addCoachMessage(userId: string, role: "USER" | "ASSISTANT", content: string, questionId?: string) {
  return prisma.coachMessage.create({
    data: { userId, role, content: redact(content), questionId: questionId ?? null },
    select: { id: true, role: true, content: true, createdAt: true },
  });
}

export async function clearCoachMessages(userId: string, questionId?: string) {
  await prisma.coachMessage.deleteMany({ where: { userId, questionId: questionId ?? null } });
}

// ─── Interview sessions ───────────────────────────────────────────────────────

export async function createInterviewSession(data: {
  userId: string;
  role: TargetRole;
  company: string;
  mode: Prisma.InterviewSessionCreateInput["mode"];
  experienceLevel?: Prisma.InterviewSessionCreateInput["experienceLevel"];
  jobDescription?: string | null;
  firstTurn: InterviewTurn;
}) {
  const transcript: InterviewTurn[] = [data.firstTurn];
  return prisma.interviewSession.create({
    data: {
      userId: data.userId,
      role: data.role,
      company: data.company,
      mode: data.mode,
      experienceLevel: data.experienceLevel,
      jobDescription: data.jobDescription ? redact(data.jobDescription) : null,
      transcript: redactDeep(transcript) as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getOwnedInterview(userId: string, id: string) {
  return prisma.interviewSession.findFirst({ where: { id, userId } });
}

/**
 * Append turns with optimistic concurrency: the write only lands if nobody else
 * modified the session since `expectedUpdatedAt`. Returns false on conflict.
 */
export async function appendInterviewTurns(
  id: string,
  expectedUpdatedAt: Date,
  transcript: InterviewTurn[],
  extra: Partial<{ answerScores: number[] }> = {}
): Promise<Date | null> {
  const now = new Date();
  const result = await prisma.interviewSession.updateMany({
    where: { id, updatedAt: expectedUpdatedAt, status: "IN_PROGRESS" },
    data: { transcript: redactDeep(transcript) as unknown as Prisma.InputJsonValue, updatedAt: now, ...extra },
  });
  return result.count === 1 ? now : null;
}

export async function completeInterviewSession(
  id: string,
  data: {
    status: "COMPLETED" | "ABANDONED";
    score: number;
    feedback: InterviewFeedback;
    metrics: InterviewMetrics;
    answerScores: number[];
    durationSec?: number;
  }
) {
  return prisma.interviewSession.update({
    where: { id },
    data: {
      status: data.status,
      score: data.score,
      feedback: redactDeep(data.feedback) as unknown as Prisma.InputJsonValue,
      metrics: data.metrics as Prisma.InputJsonValue,
      answerScores: data.answerScores,
      durationSec: data.durationSec,
      completedAt: new Date(),
    },
  });
}

export async function listInterviewSessions(userId: string, take = 20) {
  return prisma.interviewSession.findMany({
    where: { userId, status: { not: "IN_PROGRESS" } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      role: true,
      company: true,
      mode: true,
      status: true,
      score: true,
      durationSec: true,
      createdAt: true,
      answerScores: true,
    },
  });
}

// ─── Group discussions ────────────────────────────────────────────────────────

export async function createGDPerformance(data: {
  userId: string;
  topic: string;
  transcript: GDTranscriptEntry[];
  evaluation: GDEvaluation;
  contributionCount: number;
  durationSec?: number;
}) {
  return prisma.gDPerformance.create({
    data: {
      userId: data.userId,
      topic: data.topic,
      transcript: redactDeep(data.transcript) as unknown as Prisma.InputJsonValue,
      evaluation: redactDeep(data.evaluation) as unknown as Prisma.InputJsonValue,
      score: data.evaluation.score,
      contributionCount: data.contributionCount,
      durationSec: data.durationSec,
    },
  });
}

export async function getOwnedGDPerformance(userId: string, id: string) {
  return prisma.gDPerformance.findFirst({ where: { id, userId } });
}

export async function listGDPerformances(userId: string, take = 20) {
  return prisma.gDPerformance.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, topic: true, score: true, contributionCount: true, durationSec: true, createdAt: true },
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

export async function getDashboard(user: User) {
  const role = user.targetRole;
  const track = role ? TRACKS[role] : null;

  const [interviews, gds, facets] = await Promise.all([
    prisma.interviewSession.findMany({
      where: { userId: user.id, status: { not: "IN_PROGRESS" }, score: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, company: true, mode: true, score: true, feedback: true, createdAt: true, status: true },
    }),
    prisma.gDPerformance.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, topic: true, score: true, evaluation: true, createdAt: true },
    }),
    practiceFacets(user, "track"),
  ]);

  const interviewAvg = avg(interviews.slice(0, 5).map((i) => i.score ?? 0));
  const gdAvg = avg(gds.slice(0, 5).map((g) => g.score ?? 0));

  // Practice coverage across the track's focus areas (confident counts fully, reviewed partially).
  const focus = track?.focusCategories ?? [];
  const focusFacets = focus
    .map((c) => facets.find((f) => f.category === c))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));
  const focusTotal = focusFacets.reduce((a, f) => a + f.total, 0);
  const focusDone = focusFacets.reduce((a, f) => a + f.confident + f.reviewed * 0.6, 0);
  const practiceCoverage = focusTotal ? Math.round((focusDone / focusTotal) * 100) : null;

  // Readiness: weighted blend of whatever signals exist.
  const signals: [number | null, number][] = [
    [interviewAvg, 0.5],
    [practiceCoverage && practiceCoverage > 0 ? practiceCoverage : null, 0.3],
    [gdAvg, 0.2],
  ];
  const present = signals.filter((s): s is [number, number] => s[0] !== null);
  const weight = present.reduce((a, [, w]) => a + w, 0);
  const readiness = present.length ? Math.round(present.reduce((a, [v, w]) => a + v * w, 0) / weight) : null;

  // Skill profile from interview evaluations (mean of the last five).
  const recentFeedback = interviews
    .slice(0, 5)
    .map((i) => i.feedback as unknown as InterviewFeedback | null)
    .filter((f): f is InterviewFeedback => Boolean(f?.scores));
  const skill = (key: keyof InterviewFeedback["scores"]) => avg(recentFeedback.map((f) => f.scores[key]));
  const collaboration = avg(
    gds.slice(0, 5)
      .map((g) => (g.evaluation as unknown as GDEvaluation | null)?.dimensions?.collaboration)
      .filter((v): v is number => typeof v === "number")
  );
  const skills = [
    { key: "technicalDepth", label: "Technical depth", value: skill("technicalDepth") },
    { key: "problemSolving", label: "Problem solving", value: skill("problemSolving") },
    { key: "communication", label: "Communication", value: skill("communication") },
    { key: "structure", label: "Answer structure", value: skill("structure") },
    { key: "confidence", label: "Composure", value: skill("confidence") },
    { key: "collaboration", label: "Collaboration", value: collaboration },
  ];

  // Chronological score trend across interviews and discussions.
  const trend = [
    ...interviews.map((i) => ({ at: i.createdAt.toISOString(), score: i.score ?? 0, kind: "interview" as const })),
    ...gds.map((g) => ({ at: g.createdAt.toISOString(), score: g.score ?? 0, kind: "discussion" as const })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-12);

  const recent = [
    ...interviews.slice(0, 5).map((i) => ({
      id: i.id,
      kind: "interview" as const,
      title: `Mock interview · ${i.company}`,
      score: i.score,
      at: i.createdAt.toISOString(),
      href: `/interview/results?id=${i.id}`,
    })),
    ...gds.slice(0, 5).map((g) => ({
      id: g.id,
      kind: "discussion" as const,
      title: g.topic,
      score: g.score,
      at: g.createdAt.toISOString(),
      href: `/gd-room/results?id=${g.id}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  // Track-specific next actions, most valuable first.
  const actions: { title: string; detail: string; href: string; module: ModuleId }[] = [];
  if (!interviews.length) {
    actions.push({
      title: "Establish a baseline",
      detail: `Run a mock interview calibrated to the ${track?.label ?? "selected"} track to anchor your readiness score.`,
      href: "/interview/setup",
      module: "interview",
    });
  }
  const weakest = [...focusFacets]
    .map((f) => ({ ...f, pct: f.total ? (f.confident + f.reviewed * 0.6) / f.total : 0 }))
    .sort((a, b) => a.pct - b.pct)[0];
  if (weakest) {
    actions.push({
      title: `Strengthen ${weakest.label}`,
      detail: `${weakest.total - weakest.confident - weakest.reviewed} unreviewed questions in a core area for your track.`,
      href: `/journey/practice?category=${weakest.category}`,
      module: "practice",
    });
  }
  const weakestSkill = skills
    .filter((s) => s.value !== null && s.key !== "collaboration")
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];
  if (weakestSkill && (weakestSkill.value ?? 100) < 75) {
    actions.push({
      title: `Raise your ${weakestSkill.label.toLowerCase()}`,
      detail: `Your lowest interview dimension at ${weakestSkill.value}. A coached session gives feedback after every answer.`,
      href: "/interview/setup?mode=SUPPORTIVE",
      module: "interview",
    });
  }
  const lastGd = gds[0]?.createdAt;
  if (!lastGd || Date.now() - lastGd.getTime() > 14 * 24 * 60 * 60 * 1000) {
    actions.push({
      title: "Practice a group discussion",
      detail: "Moderated floor control trains you to enter a discussion decisively and build on others.",
      href: "/gd-room",
      module: "gd",
    });
  }

  return {
    track: role,
    readiness,
    interviewAvg,
    gdAvg,
    practiceCoverage,
    totals: {
      interviews: interviews.length,
      discussions: gds.length,
      practiced: facets.reduce((a, f) => a + f.reviewed + f.confident, 0),
      questions: facets.reduce((a, f) => a + f.total, 0),
    },
    focus: focusFacets,
    skills,
    trend,
    recent,
    actions: actions.slice(0, 3),
    moduleOrder: track?.moduleOrder ?? (["practice", "interview", "gd", "project", "performance"] as ModuleId[]),
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export function categoryLabel(category: PracticeCategory) {
  return CATEGORY_LABELS[category];
}
