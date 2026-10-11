"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ScoreTrend } from "@/components/charts/score-trend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { MODE_LABELS, getCompany, type InterviewMode } from "@/lib/domain";
import { useApi } from "@/lib/use-api";
import type { DashboardData } from "@/lib/db";

interface InterviewRow {
  id: string;
  company: string;
  mode: InterviewMode;
  status: "COMPLETED" | "ABANDONED" | "IN_PROGRESS";
  score: number | null;
  durationSec: number | null;
  createdAt: string;
}

interface GDRow {
  id: string;
  topic: string;
  score: number | null;
  contributionCount: number;
  createdAt: string;
}

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function PerformancePage() {
  const dash = useApi<DashboardData>("/api/dashboard");
  const interviews = useApi<{ sessions: InterviewRow[] }>("/api/interview");
  const gds = useApi<{ performances: GDRow[] }>("/api/gd");

  const loading = dash.loading || interviews.loading || gds.loading;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Performance"
        description="Every assessed session on record. Open any session for the full transcript and answer-level feedback."
      />

      {loading && !dash.data ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Score history</CardTitle>
                  <CardDescription>Interviews and discussions, oldest to newest.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {dash.data && dash.data.trend.length >= 2 ? (
                  <ScoreTrend points={dash.data.trend} height={260} />
                ) : (
                  <EmptyState className="h-[260px]" title="Not enough data yet" description="Complete at least two assessed sessions to chart your progress." />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Skill profile</CardTitle>
                  <CardDescription>Mean of recent evaluations.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5">
                {dash.data?.skills.map((s) => (
                  <div key={s.key}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-mono tabular">{s.value ?? "—"}</span>
                    </div>
                    <ProgressBar value={s.value ?? 0} tone="neutral" label={s.label} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Mock interviews</CardTitle>
                <CardDescription>{interviews.data?.sessions.length ?? 0} sessions</CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild><Link href="/interview/setup">New interview</Link></Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {interviews.data?.sessions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13px]">
                    <thead className="border-y bg-muted/30 text-left">
                      <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:font-medium [&>th]:text-muted-foreground">
                        <th>Date</th><th>Style</th><th>Format</th><th>Status</th><th className="text-right">Score</th><th />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {interviews.data.sessions.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 [&>td]:px-5 [&>td]:py-3">
                          <td className="whitespace-nowrap text-muted-foreground">{date(s.createdAt)}</td>
                          <td>{getCompany(s.company).name}</td>
                          <td>{MODE_LABELS[s.mode].label}</td>
                          <td><Badge variant={s.status === "COMPLETED" ? "success" : "outline"}>{s.status === "COMPLETED" ? "Completed" : "Ended early"}</Badge></td>
                          <td className="text-right font-mono tabular">{s.score ?? "—"}</td>
                          <td className="text-right">
                            <Link href={`/interview/results?id=${s.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                              Report <ArrowUpRight className="size-3.5" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 pb-5"><EmptyState title="No interviews yet" description="Your completed mock interviews will be listed here." /></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Group discussions</CardTitle>
                <CardDescription>{gds.data?.performances.length ?? 0} discussions</CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild><Link href="/gd-room">New discussion</Link></Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {gds.data?.performances.length ? (
                <ul className="divide-y border-t">
                  {gds.data.performances.map((g) => (
                    <li key={g.id}>
                      <Link href={`/gd-room/results?id=${g.id}`} className="flex items-center gap-4 px-5 py-3 text-[13px] hover:bg-muted/30">
                        <span className="w-24 shrink-0 text-muted-foreground">{date(g.createdAt)}</span>
                        <span className="min-w-0 flex-1 truncate">{g.topic}</span>
                        <span className="hidden text-muted-foreground sm:inline">{g.contributionCount} turns</span>
                        <span className="w-10 text-right font-mono tabular">{g.score ?? "—"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 pb-5"><EmptyState title="No discussions yet" description="Completed group discussions will be listed here." /></div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
