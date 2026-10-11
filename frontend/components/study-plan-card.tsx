"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Bot, ChevronDown, Compass, FileCode2, LineChart, RefreshCw, Sparkles, Users, Video, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type ItemKind = "practice" | "interview" | "gd" | "study" | "project" | "review";

interface PlanItem {
  day: number;
  title: string;
  detail: string;
  kind: ItemKind;
  minutes: number;
  href?: string;
}

interface Plan {
  id: string;
  headline: string;
  rationale: string;
  items: PlanItem[];
  source: "agent" | "rules";
  steps: { tool: string; summary: string; ms: number; ok: boolean }[];
  createdAt: string;
}

const KIND: Record<ItemKind, { icon: typeof Video; cls: string; label: string }> = {
  practice: { icon: BookOpen, cls: "bg-mod-practice/12 text-mod-practice ring-mod-practice/25", label: "Practice" },
  interview: { icon: Video, cls: "bg-mod-interview/12 text-mod-interview ring-mod-interview/25", label: "Interview" },
  gd: { icon: Users, cls: "bg-mod-gd/12 text-mod-gd ring-mod-gd/25", label: "Discussion" },
  study: { icon: Compass, cls: "bg-accent-soft text-accent ring-accent/25", label: "Study" },
  project: { icon: FileCode2, cls: "bg-mod-project/12 text-mod-project ring-mod-project/25", label: "Project" },
  review: { icon: LineChart, cls: "bg-mod-performance/12 text-mod-performance ring-mod-performance/25", label: "Review" },
};

/**
 * "Your plan" — written by the Prep Planner agent, which reads the profile and
 * scores with tools before planning. The tool trace is shown for transparency.
 */
export function StudyPlanCard() {
  const { data, loading, setData } = useApi<{ plan: Plan | null }>("/api/agents/plan");
  const [planning, setPlanning] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const toast = useToast();
  const plan = data?.plan ?? null;

  async function replan() {
    setPlanning(true);
    try {
      const res = await api<{ plan: Plan }>("/api/agents/plan", { method: "POST", timeoutMs: 70_000 });
      setData(res);
      setShowSteps(false);
    } catch (error) {
      toast.error("Could not build a plan", errorMessage(error));
    } finally {
      setPlanning(false);
    }
  }

  const days = plan ? [...new Set(plan.items.map((i) => i.day))].sort((a, b) => a - b) : [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/40 pb-4">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            Your preparation plan
            {plan && (
              <Badge variant={plan.source === "agent" ? "accent" : "outline"} className="ml-1">
                {plan.source === "agent" ? (
                  <>
                    <Bot /> Planned by AI agent
                  </>
                ) : (
                  "Planned offline"
                )}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {plan ? plan.headline : "The planner agent reads your profile, scores and weak answers, then builds the next few days for you."}
          </CardDescription>
        </div>
        <Button size="sm" variant={plan ? "outline" : "default"} onClick={replan} disabled={planning}>
          {planning ? <Spinner className="text-current" /> : plan ? <RefreshCw /> : <Sparkles />}
          {planning ? "Planning…" : plan ? "Re-plan" : "Build my plan"}
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : planning && !plan ? (
          <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
            <Spinner /> Reviewing your profile and recent sessions…
          </p>
        ) : !plan ? (
          <p className="py-4 text-[13px] text-muted-foreground">No plan yet. It takes a few seconds and adapts as you practise.</p>
        ) : (
          <div className="space-y-4">
            {plan.rationale && <p className="text-[13px] leading-6 text-muted-foreground">{plan.rationale}</p>}
            <ol className="space-y-3">
              {days.map((day) => (
                <li key={day} className="grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                  <span className="pt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-subtle">Day {day}</span>
                  <ul className="space-y-2">
                    {plan.items
                      .filter((i) => i.day === day)
                      .map((item, idx) => {
                        const k = KIND[item.kind] ?? KIND.study;
                        const Icon = k.icon;
                        return (
                          <li key={`${day}-${idx}`}>
                            <Link
                              href={item.href ?? "/home"}
                              className="lift group flex items-start gap-3 rounded-lg border bg-card p-3 hover:border-border-strong"
                            >
                              <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring-1", k.cls)}>
                                <Icon className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                                  {item.title}
                                  <span className="shrink-0 font-mono text-[11px] font-normal text-subtle">{item.minutes} min</span>
                                </span>
                                <span className="mt-0.5 block text-[12.5px] leading-5 text-muted-foreground">{item.detail}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ol>

            {plan.steps.length > 0 && (
              <div className="rounded-lg border border-dashed">
                <button
                  type="button"
                  onClick={() => setShowSteps((s) => !s)}
                  aria-expanded={showSteps}
                  className="flex w-full items-center justify-between px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Wrench className="size-3.5" /> How this plan was made ({plan.steps.length} tool calls)
                  </span>
                  <ChevronDown className={cn("size-3.5 transition-transform", showSteps && "rotate-180")} />
                </button>
                {showSteps && (
                  <ol className="space-y-1 border-t px-3 py-2">
                    {plan.steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span className={cn("size-1.5 rounded-full", s.ok ? "bg-success" : "bg-warning")} />
                        <span className="font-mono text-[11px] text-subtle">{s.tool}</span>
                        <span className="truncate">{s.summary}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
