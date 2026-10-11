"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { scoreBand } from "@/lib/domain";
import { useApi } from "@/lib/use-api";
import type { GDEvaluation } from "@/lib/db";
import { cn } from "@/lib/utils";

interface Performance {
  id: string;
  topic: string;
  score: number | null;
  evaluation: GDEvaluation | null;
  transcript: { speakerId: string; speakerName: string; text: string }[];
  contributionCount: number;
  durationSec: number | null;
  createdAt: string;
}

const DIMENSIONS: [keyof GDEvaluation["dimensions"], string, string][] = [
  ["clarity", "Clarity", "Structured, easy-to-follow points"],
  ["relevance", "Relevance", "Stayed on the question being discussed"],
  ["collaboration", "Collaboration", "Built on or challenged others by name"],
  ["initiative", "Initiative", "Claimed the floor early and consistently"],
];

function Results() {
  const id = useSearchParams().get("id");
  const { data, error, loading } = useApi<{ performance: Performance }>(id ? "/api/gd" : null, { id });

  if (!id) return <EmptyState title="No discussion selected" action={<Button size="sm" asChild><Link href="/gd-room">Start a discussion</Link></Button>} />;
  if (loading) return <Skeleton className="h-[480px]" />;
  if (error || !data?.performance.evaluation) return <EmptyState title="This discussion couldn't be loaded" description={error ?? undefined} />;

  const p = data.performance;
  const ev = p.evaluation!;
  const band = scoreBand(p.score);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Group discussion · ${new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
        title={p.topic}
        description={`${p.contributionCount} contribution${p.contributionCount === 1 ? "" : "s"}${p.durationSec ? ` · ${Math.round(p.durationSec / 60)} min` : ""}`}
        actions={
          <Button asChild>
            <Link href="/gd-room"><RotateCcw /> New discussion</Link>
          </Button>
        }
      />

      {ev.source === "heuristic" && (
        <div className="flex gap-2.5 rounded-md border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          Scored with the offline rubric. Add a Gemini API key for transcript-level assessment.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="eyebrow">Discussion score</p>
            <p className="mt-3 flex items-baseline gap-1.5 text-5xl font-semibold tracking-tight tabular">
              {p.score ?? "—"}
              <span className="text-base font-normal text-muted-foreground">/ 100</span>
            </p>
            <p className="mt-2 text-[13px] font-medium">{band.label}</p>
            <p className="mt-3 text-[13px] leading-6 text-muted-foreground">{ev.summary}</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Assessment dimensions</CardTitle>
              <CardDescription>How group-discussion panels typically score candidates.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {DIMENSIONS.map(([key, label, hint]) => (
              <div key={key}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span>{label}</span>
                  <span className="font-mono tabular">{ev.dimensions[key]}</span>
                </div>
                <ProgressBar value={ev.dimensions[key]} label={label} />
                <p className="mt-1.5 text-[12px] text-muted-foreground">{hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Strengths", items: ev.strengths, dot: "bg-success" },
          { title: "Improve next", items: ev.improvements, dot: "bg-warning" },
        ].map((col) => (
          <Card key={col.title}>
            <CardHeader><CardTitle>{col.title}</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2.5 text-[13px] leading-5">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2.5"><span className={cn("mt-2 size-1.5 shrink-0 rounded-full", col.dot)} />{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Transcript</CardTitle></CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {p.transcript.map((t, i) => (
              <li key={i} className={cn("text-[13px] leading-6", t.speakerId === "user" && "rounded-md border-l-2 border-accent bg-accent-soft/50 px-3 py-2")}>
                <span className={cn("font-medium", t.speakerId === "moderator" && "text-muted-foreground")}>{t.speakerName}: </span>
                <span className={t.speakerId === "moderator" ? "italic text-muted-foreground" : ""}>{t.text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GDResultsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[480px]" />}>
      <Results />
    </Suspense>
  );
}
