import { authedRoute } from "@/lib/server/api";
import { prisma } from "@/lib/prisma";
import { createStudyPlan, type PlanResult } from "@/lib/agents/planner";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface StoredPlan extends Omit<PlanResult, "steps"> {
  id: string;
  createdAt: string;
  steps: PlanResult["steps"];
}

function serialize(p: {
  id: string;
  headline: string;
  rationale: string | null;
  items: unknown;
  source: string;
  steps: unknown;
  createdAt: Date;
}): StoredPlan {
  return {
    id: p.id,
    headline: p.headline,
    rationale: p.rationale ?? "",
    items: p.items as PlanResult["items"],
    source: p.source === "agent" ? "agent" : "rules",
    steps: (p.steps ?? []) as PlanResult["steps"],
    createdAt: p.createdAt.toISOString(),
  };
}

/** GET /api/agents/plan — the candidate's latest study plan, if any. */
export const GET = authedRoute(async ({ user }) => {
  const latest = await prisma.studyPlan.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return { plan: latest ? serialize(latest) : null };
});

/** POST /api/agents/plan — run the Prep Planner agent (rules when offline) and save the plan. */
export const POST = authedRoute(async ({ user }) => {
  const plan = await createStudyPlan(user);
  const saved = await prisma.studyPlan.create({
    data: {
      userId: user.id,
      headline: plan.headline,
      rationale: plan.rationale,
      items: plan.items,
      source: plan.source,
      steps: plan.steps.map((s) => ({ ...s, args: s.args })) as object[],
    },
  });
  // Keep the five most recent plans.
  const old = await prisma.studyPlan.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: 5, select: { id: true } });
  if (old.length) await prisma.studyPlan.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  return { plan: serialize(saved) };
});
