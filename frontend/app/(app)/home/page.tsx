"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, LogOut, RefreshCw, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { ScoreTrend } from "@/components/charts/score-trend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, ProgressBar, SectionHeading, Skeleton, Stat } from "@/components/ui/primitives";
import { CAREER_STAGE_LABELS, CATEGORY_LABELS, TIMELINE_LABELS, TRACKS, scoreBand, type ModuleId, type TargetRole } from "@/lib/domain";
import { MODULE_BY_ID } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { TrackSwitcher } from "@/components/track-switcher";
import { BlurText } from "@/components/motion";
import { StudyPlanCard } from "@/components/study-plan-card";
import type { DashboardData } from "@/lib/db";

const MODULES: Record<ModuleId, { describe: (role: TargetRole) => string }> = {
  interview: {
    describe: (role) => `A five-question loop on ${TRACKS[role].interviewFocus.split(",").slice(0, 2).join(" and")}, scored per answer.`,
  },
  practice: {
    describe: (role) =>
      `Curated questions in ${TRACKS[role].focusCategories.slice(0, 3).map((c) => CATEGORY_LABELS[c]).join(", ")} with model answers.`,
  },
  gd: {
    describe: () => "A moderated panel with four AI candidates and strict floor control. Practice entering and yielding.",
  },
  project: {
    describe: (role) => `Upload a project write-up and defend it the way an interview panel for ${TRACKS[role].label} roles would.`,
  },
  performance: {
    describe: () => "Every session on record, with sub-scores, trends and the answers that cost you points.",
  },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const { data, error, loading, reload } = useApi<DashboardData>("/api/dashboard");
  const role = profile?.targetRole as TargetRole;
  const track = TRACKS[role];
  const firstName = profile?.name?.split(" ")[0];

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <EmptyState
        title="The dashboard couldn't load"
        description={error}
        action={
          <Button size="sm" variant="outline" onClick={reload}>
            <RefreshCw /> Retry
          </Button>
        }
      />
    );
  }
  if (!data) return null;

  const band = scoreBand(data.readiness);
  const bandVariant = band.tone === "strong" ? "success" : band.tone === "steady" ? "accent" : band.tone === "developing" ? "warning" : "outline";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={<TrackSwitcher onChanged={reload} />}
        title={<BlurText key={role} text={`${greeting()}${firstName ? `, ${firstName}` : ""}.`} />}
        description={track.summary}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/journey/practice">Practice questions</Link>
            </Button>
            <Button asChild>
              <Link href="/interview/setup">
                Start mock interview <ArrowRight />
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <section aria-label="Key metrics" className="animate-blur-in grid gap-px overflow-hidden rounded-xl border bg-border shadow-panel sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card p-5">
          <Stat
            label="Readiness index"
            value={data.readiness ?? "—"}
            unit={data.readiness !== null ? "/ 100" : undefined}
            hint={<Badge variant={bandVariant}>{band.label}</Badge>}
          />
        </div>
        <div className="bg-card p-5">
          <Stat
            label="Interview average"
            value={data.interviewAvg ?? "—"}
            hint={`${data.totals.interviews} session${data.totals.interviews === 1 ? "" : "s"} · last five weighted`}
          />
        </div>
        <div className="bg-card p-5">
          <Stat
            label="Core-area coverage"
            value={data.practiceCoverage ?? 0}
            unit="%"
            hint={`${data.totals.practiced} of ${data.totals.questions} track questions practiced`}
          />
        </div>
        <div className="bg-card p-5">
          <Stat
            label="Discussion average"
            value={data.gdAvg ?? "—"}
            hint={`${data.totals.discussions} group discussion${data.totals.discussions === 1 ? "" : "s"}`}
          />
        </div>
      </section>

      {/* Agent-built plan */}
      <StudyPlanCard />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Score trend</CardTitle>
              <CardDescription>Your last twelve assessed sessions.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/performance">
                Details <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.trend.length >= 2 ? (
              <ScoreTrend points={data.trend} />
            ) : (
              <EmptyState
                className="h-[220px]"
                title={data.trend.length ? "One session recorded" : "No assessed sessions yet"}
                description="Complete two sessions to see your trajectory. Each mock interview and discussion is scored and saved."
              />
            )}
          </CardContent>
        </Card>

        {/* Next actions */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recommended next</CardTitle>
              <CardDescription>Prioritized for the {track.label} track.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.actions.length ? (
              data.actions.map((a, i) => (
                <Link
                  key={a.title}
                  href={a.href}
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                  className="animate-pop-in lift group flex gap-3 rounded-md border p-3 hover:border-border-strong hover:bg-muted/40"
                >
                  <span className="font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                      {a.title}
                      <ArrowRight className="size-3.5 text-subtle transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground">{a.detail}</span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-[13px] text-muted-foreground">You&apos;re on track. Keep a steady cadence of sessions.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Focus coverage */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Core areas for your track</CardTitle>
              <CardDescription>Practice coverage in the domains {track.label} interviews weight most.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.focus.map((f) => {
                const done = f.confident + f.reviewed;
                const pct = f.total ? ((f.confident + f.reviewed * 0.6) / f.total) * 100 : 0;
                return (
                  <li key={f.category}>
                    <Link
                      href={`/journey/practice?category=${f.category}`}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]"
                    >
                      <span className="text-[13px] font-medium group-hover:text-accent">{f.label}</span>
                      <ProgressBar value={pct} className="col-span-2 sm:col-span-1" label={`${f.label} coverage`} />
                      <span className="row-start-1 text-right font-mono text-[12px] text-muted-foreground tabular sm:row-start-auto">
                        {done}/{f.total}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Skill profile */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Skill profile</CardTitle>
              <CardDescription>Mean of your last five evaluations.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {data.skills.map((s) => (
              <div key={s.key}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-mono text-[12px] tabular">{s.value ?? "—"}</span>
                </div>
                <ProgressBar value={s.value ?? 0} tone="neutral" label={s.label} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Modules, ordered for the track */}
      <section aria-labelledby="modules-heading">
        <SectionHeading id="modules-heading" title="Training modules" description="Each area has its own colour, so you always know where you are." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.moduleOrder.map((id, i) => {
            const m = MODULE_BY_ID[id];
            const Icon = m.icon;
            return (
              <Link
                key={id}
                href={m.href}
                style={{ animationDelay: `${i * 70}ms` }}
                className="animate-pop-in lift group relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-panel hover:border-border-strong"
              >
                <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px] bg-current", m.text)} />
                <span className="flex items-center justify-between">
                  <span className={cn("flex size-9 items-center justify-center rounded-lg ring-1", m.chip)}>
                    <Icon className="size-4" />
                  </span>
                  <ArrowUpRight className="size-4 text-subtle transition-colors group-hover:text-foreground" />
                </span>
                <span className="mt-4 text-sm font-semibold">{m.label}</span>
                <span className="mt-1 text-[13px] leading-5 text-muted-foreground">{MODULES[id].describe(role)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Profile and account */}
      <section aria-labelledby="account-heading">
        <SectionHeading id="account-heading" title="Your profile" description="Interviewers adapt to these details. Change them any time." />
        <Card>
          <CardContent className="grid gap-5 pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="eyebrow">Career stage</dt>
                <dd className="mt-1 font-medium">{profile?.careerStage ? CAREER_STAGE_LABELS[profile.careerStage].label : "Not set"}</dd>
              </div>
              <div>
                <dt className="eyebrow">Track</dt>
                <dd className="mt-1 font-medium">{track.label}</dd>
              </div>
              <div>
                <dt className="eyebrow">Interviews</dt>
                <dd className="mt-1 font-medium">{profile?.interviewTimeline ? TIMELINE_LABELS[profile.interviewTimeline].label : "Not set"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="eyebrow">Target companies</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-medium">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{profile?.targetCompanies?.length ? profile.targetCompanies.join(", ") : "Any"}</span>
                </dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/settings">
                  <Settings2 /> Settings
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <LogOut /> Log out
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Recent activity */}
      {data.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-1">
            <ul className="divide-y border-t">
              {data.recent.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40">
                    <Badge variant="outline">{r.kind === "interview" ? "Interview" : "Discussion"}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{r.title}</span>
                    <span className="hidden text-[12px] text-muted-foreground sm:block">
                      {new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <span className="w-10 text-right font-mono text-[13px] tabular">{r.score ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
