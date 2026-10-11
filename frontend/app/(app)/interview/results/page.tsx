"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, ChevronDown, Info, RotateCcw } from "lucide-react";
import { BlurText, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { MODE_LABELS, TRACKS, getCompany, scoreBand } from "@/lib/domain";
import { useApi } from "@/lib/use-api";
import type { InterviewFeedback, InterviewTurn } from "@/lib/db";
import type { ExperienceLevel, InterviewMode, TargetRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface SessionDetail {
  id: string;
  role: TargetRole;
  company: string;
  mode: InterviewMode;
  experienceLevel: ExperienceLevel | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  score: number | null;
  feedback: InterviewFeedback | null;
  transcript: InterviewTurn[];
  metrics: { eyeContact?: number; posture?: number; smile?: number; fillerWords?: number; facePresence?: number; cameraSec?: number } | null;
  durationSec: number | null;
  createdAt: string;
}

const SCORE_LABELS: Record<keyof InterviewFeedback["scores"], string> = {
  technicalDepth: "Technical depth",
  problemSolving: "Problem solving",
  communication: "Communication",
  structure: "Answer structure",
  confidence: "Composure",
};

const VERDICT_TONE = { Ready: "success", "Almost ready": "accent", "Needs more preparation": "warning" } as const;

const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s` : `${sec}s`);

/** Webcam and speech measurements, each with how it was measured. */
function deliveryTiles(m: SessionDetail["metrics"]) {
  const camera = m?.cameraSec;
  return [
    {
      label: "Eye contact",
      value: m?.eyeContact != null ? `${m.eyeContact}%` : "—",
      detail:
        m?.eyeContact != null && camera
          ? `Looking at the screen for ${fmtDuration(Math.round((m.eyeContact / 100) * camera))} of ${fmtDuration(camera)} on camera`
          : "Not measured — the camera was off or on for under 15 seconds",
    },
    {
      label: "Upright posture",
      value: m?.posture != null ? `${m.posture}%` : "—",
      detail:
        m?.posture != null
          ? "Share of the time your shoulders were visible that you sat upright and level"
          : m?.eyeContact != null
            ? "Not measured — your shoulders weren't visible to the camera"
            : "Not measured — the camera was off",
    },
    {
      label: "Filler words",
      value: m?.fillerWords != null ? String(m.fillerWords) : "—",
      detail: "Counted in your answers: um, uh, like, you know, basically…",
    },
  ];
}

function Results() {
  const id = useSearchParams().get("id");
  const { data, error, loading } = useApi<{ session: SessionDetail }>(id ? "/api/interview" : null, { id });
  const [open, setOpen] = useState<number | null>(0);

  if (!id) {
    return (
      <EmptyState
        title="No interview selected"
        description="Open a session from your performance history, or start a new interview."
        action={<Button size="sm" asChild><Link href="/dashboard/performance">View history</Link></Button>}
      />
    );
  }
  if (loading) return <Skeleton className="h-[480px]" />;
  if (error || !data) return <EmptyState title="This interview couldn't be loaded" description={error ?? undefined} />;

  const s = data.session;
  const fb = s.feedback;
  const company = getCompany(s.company);
  const band = scoreBand(s.score);

  if (!fb) {
    return (
      <EmptyState
        title="This interview wasn't completed"
        description="The session ended before it could be evaluated."
        action={<Button size="sm" asChild><Link href="/interview/setup">Start a new interview</Link></Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Interview report · ${new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
        title={`${company.name} · ${TRACKS[s.role].label}`}
        description={`${MODE_LABELS[s.mode].label} format${s.durationSec ? ` · ${Math.round(s.durationSec / 60)} min` : ""}${s.status === "ABANDONED" ? " · ended early" : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/journey/practice">Practice weak areas</Link>
            </Button>
            <Button asChild>
              <Link href={`/interview/setup?mode=${s.mode}`}>
                <RotateCcw /> New interview
              </Link>
            </Button>
          </>
        }
      />

      {fb.source === "heuristic" && (
        <div className="flex gap-2.5 rounded-md border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Scored with the offline rubric (length, structure, quantified impact, ownership and delivery). Add a Gemini API key for model-graded,
          content-aware evaluation.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="eyebrow">Overall score</p>
            <p className="animate-pop-in mt-3 flex items-baseline gap-1.5 text-5xl font-semibold tracking-tight tabular">
              {s.score ?? "—"}
              <span className="text-base font-normal text-muted-foreground">/ 100</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={VERDICT_TONE[fb.verdict]}>{fb.verdict}</Badge>
              <Badge variant="outline">{band.label}</Badge>
            </div>
            <BlurText as="p" text={fb.summary} className="mt-4 block text-[13px] leading-6 text-muted-foreground" delayMs={200} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Dimension scores</CardTitle>
              <CardDescription>Weighted toward technical depth and problem solving.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {(Object.keys(SCORE_LABELS) as (keyof InterviewFeedback["scores"])[]).map((k) => (
              <div key={k}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{SCORE_LABELS[k]}</span>
                  <span className="font-mono tabular">{fb.scores[k]}</span>
                </div>
                <ProgressBar value={fb.scores[k]} label={SCORE_LABELS[k]} />
              </div>
            ))}
            <div className="grid gap-4 border-t pt-4 sm:col-span-2 sm:grid-cols-3">
              {deliveryTiles(s.metrics).map((t) => (
                <div key={t.label}>
                  <p className="eyebrow">{t.label}</p>
                  <p className="mt-1 font-mono text-lg tabular">{t.value}</p>
                  <p className="mt-0.5 text-[11.5px] leading-4 text-muted-foreground">{t.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Strengths", items: fb.strengths, dot: "bg-success" },
          { title: "Improve next", items: fb.improvements, dot: "bg-warning" },
          { title: "Practice plan", items: fb.nextSteps, dot: "bg-accent" },
        ].map((col, ci) => (
          <Reveal key={col.title} delayMs={ci * 90}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{col.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-[13px] leading-5">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", col.dot)} />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          </Reveal>
        ))}
      </div>

      <Reveal>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Answer-by-answer review</CardTitle>
            <CardDescription>Compare what you said with a strong answer, and see exactly what to study for next time.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ul className="divide-y border-t">
            {fb.perAnswer.map((a, i) => {
              const label = a.kind === "followup" ? "Follow-up" : a.kind === "coaching" ? "Retry" : `Q${fb.perAnswer.slice(0, i + 1).filter((x) => !x.kind || x.kind === "question").length}`;
              return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-muted/40"
                >
                  <span className="w-16 shrink-0 font-mono text-[12px] text-subtle">{label}</span>
                  <span className="flex-1 text-[14px] leading-6">
                    {a.question}
                    {a.attempted === false && (
                      <Badge variant="warning" className="ml-2 align-middle">Not attempted</Badge>
                    )}
                  </span>
                  <span className="font-mono text-[13px] tabular">{a.score}</span>
                  <ChevronDown className={cn("mt-1 size-4 text-subtle transition-transform", open === i && "rotate-180")} />
                </button>
                {open === i && (
                  <div className="animate-blur-in grid gap-4 px-5 pb-5 md:grid-cols-2">
                    <div>
                      <p className="eyebrow mb-1.5">Your answer</p>
                      <p className="whitespace-pre-wrap rounded-md border bg-background px-4 py-3 text-[13px] leading-6 text-muted-foreground">{a.answer}</p>
                    </div>
                    <div>
                      <p className="eyebrow mb-1.5">Model answer</p>
                      <p className="rounded-md border bg-card px-4 py-3 text-[13px] leading-6">{a.idealAnswer}</p>
                      {a.note && <p className="mt-2 text-[12px] text-muted-foreground">{a.note}</p>}
                    </div>
                    {a.keyPoints && a.keyPoints.length > 0 && (
                      <div className="rounded-md border border-accent/25 bg-accent-soft px-4 py-3 md:col-span-2">
                        <p className="eyebrow mb-2 text-accent">What to study before your next interview</p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {a.keyPoints.map((k, ki) => (
                            <li key={k} className="animate-blur-in flex gap-2 text-[13px] leading-5" style={{ animationDelay: `${ki * 80}ms` }}>
                              <BookOpen className="mt-0.5 size-3.5 shrink-0 text-accent" />
                              {k}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      </Reveal>

      <div className="flex justify-end">
        <Button variant="ghost" asChild>
          <Link href="/home">
            Back to dashboard <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function InterviewResultsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px]" />}>
      <Results />
    </Suspense>
  );
}
