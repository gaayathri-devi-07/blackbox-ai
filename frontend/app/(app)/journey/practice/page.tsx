"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, MessageSquare, RefreshCw, Search, Tag, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { CoachPanel } from "@/components/practice/coach-panel";
import { QuestionDetail } from "@/components/practice/question-detail";
import type { PracticeQuestionDTO } from "@/components/practice/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, ProgressBar, SegmentedControl, Skeleton, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import {
  TARGET_ROLES,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  PRACTICE_CATEGORIES,
  TRACKS,
  type Difficulty,
  type PracticeCategory,
  type TargetRole,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

interface Facet {
  category: PracticeCategory;
  label: string;
  total: number;
  reviewed: number;
  confident: number;
}

interface TagFacet {
  tag: string;
  count: number;
}

interface PracticeResponse {
  tags?: TagFacet[] | null;
  questions: PracticeQuestionDTO[];
  nextCursor: string | null;
  facets: Facet[] | null;
}

type Scope = "track" | "all";
type StatusFilter = "any" | "new" | "reviewed" | "confident";

const DIFFICULTY_TONE: Record<Difficulty, "success" | "accent" | "warning"> = { EASY: "success", MEDIUM: "accent", HARD: "warning" };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PracticeHub() {
  const { profile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // The track can be switched here (e.g. to explore Backend questions) without changing the profile.
  const rawTrack = params.get("track");
  const selectedRole = (TARGET_ROLES.includes(rawTrack as TargetRole) ? rawTrack : profile?.targetRole ?? null) as TargetRole | null;
  const track = selectedRole ? TRACKS[selectedRole] : null;
  const tag = params.get("tag");

  // Filters are URL state so links from the dashboard (and shared links) work.
  const rawCategory = params.get("category");
  const category = PRACTICE_CATEGORIES.includes(rawCategory as PracticeCategory) ? (rawCategory as PracticeCategory) : null;
  const scope = (params.get("scope") === "all" ? "all" : "track") as Scope;
  const difficulty = (["EASY", "MEDIUM", "HARD"].includes(params.get("difficulty") ?? "") ? params.get("difficulty") : "ALL") as Difficulty | "ALL";
  const status = (["new", "reviewed", "confident"].includes(params.get("status") ?? "") ? params.get("status") : "any") as StatusFilter;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search.trim(), 300);

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "" || v === "any" || v === "ALL" || (k === "scope" && v === "track") || (k === "track" && v === profile?.targetRole)) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
    },
    [params, pathname, router, profile?.targetRole]
  );

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) setParam({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const [questions, setQuestions] = useState<PracticeQuestionDTO[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [tagFacets, setTagFacets] = useState<TagFacet[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [coachQuestion, setCoachQuestion] = useState<PracticeQuestionDTO | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [nonce, setNonce] = useState(0);

  const query = useMemo(
    () => ({
      scope,
      track: scope === "track" && selectedRole ? selectedRole : undefined,
      category: category ?? undefined,
      difficulty: difficulty === "ALL" ? undefined : difficulty,
      tag: tag ?? undefined,
      status,
      q: q || undefined,
      limit: 20,
    }),
    [scope, selectedRole, category, difficulty, tag, status, q]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<PracticeResponse>("/api/practice", { query, signal: controller.signal })
      .then((res) => {
        setQuestions(res.questions);
        setCursor(res.nextCursor);
        if (res.facets) setFacets(res.facets);
        if (res.tags) setTagFacets(res.tags);
        setOpenId(null);
      })
      .catch((err) => !controller.signal.aborted && setError(errorMessage(err)))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [query, nonce]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await api<PracticeResponse>("/api/practice", { query: { ...query, cursor } });
      setQuestions((prev) => [...prev, ...res.questions]);
      setCursor(res.nextCursor);
    } catch (err) {
      toast.error("Couldn't load more questions", errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  const updateStatus = useCallback((question: PracticeQuestionDTO, next: PracticeQuestionDTO["status"]) => {
    const previous = question.status;
    if (previous === next) return;
    setQuestions((prev) => prev.map((x) => (x.id === question.id ? { ...x, status: next } : x)));
    // Keep facet counters in step without refetching.
    const delta = (s: PracticeQuestionDTO["status"], k: "REVIEWED" | "CONFIDENT") => (s === k ? 1 : 0);
    setFacets((prev) =>
      prev.map((f) =>
        f.category !== question.category
          ? f
          : {
              ...f,
              reviewed: f.reviewed - delta(previous, "REVIEWED") + delta(next, "REVIEWED"),
              confident: f.confident - delta(previous, "CONFIDENT") + delta(next, "CONFIDENT"),
            }
      )
    );
  }, []);

  const totalAll = facets.reduce((a, f) => a + f.total, 0);
  const doneAll = facets.reduce((a, f) => a + f.reviewed + f.confident, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Practice Hub"
        title={
          scope === "track" && track ? (
            <>
              Questions calibrated for <span className="font-display text-[1.15em] font-normal italic">{track.label}</span>
            </>
          ) : (
            "The full question bank"
          )
        }
        description="Every question carries a model answer, the common weak answer, and why the difference matters. Attempt it yourself to get graded."
        actions={
          <>
            <select
              aria-label="Track"
              value={scope === "all" ? "ALL" : (selectedRole ?? "ALL")}
              onChange={(e) =>
                e.target.value === "ALL"
                  ? setParam({ scope: "all", track: null, category: null, tag: null })
                  : setParam({ scope: "track", track: e.target.value, category: null, tag: null })
              }
              className="h-9 rounded-md border border-input bg-card px-2.5 text-[13px] font-medium text-foreground"
            >
              {TARGET_ROLES.map((r) => (
                <option key={r} value={r}>
                  {TRACKS[r].label}
                  {r === profile?.targetRole ? " (my track)" : ""}
                </option>
              ))}
              <option value="ALL">All tracks</option>
            </select>
            <Button variant="outline" onClick={() => { setCoachQuestion(null); setCoachOpen(true); }}>
              <MessageSquare /> Coach
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Domains */}
        <aside aria-label="Domains" className="lg:sticky lg:top-6 lg:self-start">
          <p className="eyebrow mb-2 px-2">Domains</p>
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            <button
              type="button"
              onClick={() => setParam({ category: null })}
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px]",
                !category ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              All domains
              <span className="font-mono text-[11px] text-subtle tabular">{doneAll}/{totalAll}</span>
            </button>
            {facets.map((f) => (
              <button
                key={f.category}
                type="button"
                onClick={() => setParam({ category: f.category })}
                className={cn(
                  "flex shrink-0 flex-col gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px]",
                  category === f.category ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  {f.label}
                  {track?.focusCategories.includes(f.category) && scope === "track" ? (
                    <span className="hidden text-[10px] uppercase tracking-wide text-accent lg:inline">Core</span>
                  ) : null}
                  <span className="font-mono text-[11px] text-subtle tabular">{f.reviewed + f.confident}/{f.total}</span>
                </span>
                <ProgressBar value={f.total ? ((f.confident + f.reviewed * 0.6) / f.total) * 100 : 0} className="hidden h-1 lg:block" />
              </button>
            ))}
          </nav>
        </aside>

        <section aria-label="Questions" className="min-w-0">
          {category && (
            <div className="mb-4 rounded-lg border bg-card px-4 py-3">
              <p className="text-sm font-medium">{CATEGORY_LABELS[category]}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{CATEGORY_DESCRIPTIONS[category]}</p>
            </div>
          )}

          {tagFacets.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter by tag">
              <Tag className="mr-0.5 size-3.5 text-subtle" aria-hidden />
              {tag && !tagFacets.some((t) => t.tag === tag) && (
                <button type="button" onClick={() => setParam({ tag: null })} className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent">
                  {tag} <X className="size-3" />
                </button>
              )}
              {tagFacets.slice(0, 16).map((t) => {
                const active = t.tag === tag;
                return (
                  <button
                    key={t.tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setParam({ tag: active ? null : t.tag })}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
                      active ? "border-accent bg-accent-soft font-medium text-accent" : "text-muted-foreground hover:border-border-strong hover:text-foreground"
                    )}
                  >
                    {t.tag}
                    <span className="font-mono text-[10.5px] text-subtle">{t.count}</span>
                    {active && <X className="size-3" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions or tags"
                aria-label="Search questions"
                className="h-9 pl-9"
              />
            </div>
            <SegmentedControl<Difficulty | "ALL">
              ariaLabel="Difficulty"
              value={difficulty}
              onChange={(v) => setParam({ difficulty: v })}
              options={[
                { value: "ALL", label: "All" },
                { value: "EASY", label: DIFFICULTY_LABELS.EASY },
                { value: "MEDIUM", label: DIFFICULTY_LABELS.MEDIUM },
                { value: "HARD", label: DIFFICULTY_LABELS.HARD },
              ]}
            />
            <select
              aria-label="Progress status"
              value={status}
              onChange={(e) => setParam({ status: e.target.value })}
              className="h-9 rounded-md border border-input bg-card px-2.5 text-[13px] text-foreground"
            >
              <option value="any">Any status</option>
              <option value="new">Not started</option>
              <option value="reviewed">Reviewed</option>
              <option value="confident">Confident</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : error ? (
            <EmptyState
              title="Questions couldn't load"
              description={error}
              action={<Button size="sm" variant="outline" onClick={() => setNonce((n) => n + 1)}><RefreshCw /> Retry</Button>}
            />
          ) : questions.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No questions match these filters"
              description="Try another domain or tag, clear the search, or switch to all tracks."
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {questions.map((question) => {
                const open = openId === question.id;
                return (
                  <li key={question.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : question.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-4 px-4 py-3.5 text-left hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">{CATEGORY_LABELS[question.category]}</Badge>
                          <Badge variant={DIFFICULTY_TONE[question.difficulty]}>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
                          {question.status === "CONFIDENT" && <Badge variant="success">Confident</Badge>}
                          {question.status === "REVIEWED" && <Badge>Reviewed</Badge>}
                        </span>
                        <span className="mt-2 block text-sm font-medium leading-6">{question.question}</span>
                      </span>
                      <ChevronDown className={cn("mt-1 size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <QuestionDetail
                        question={question}
                        onStatusChange={(s) => updateStatus(question, s)}
                        onAskCoach={() => {
                          setCoachQuestion(question);
                          setCoachOpen(true);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {cursor && !loading && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Spinner />}
                Load more questions
              </Button>
            </div>
          )}
        </section>
      </div>

      <CoachPanel open={coachOpen} onClose={() => setCoachOpen(false)} question={coachQuestion} />
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PracticeHub />
    </Suspense>
  );
}
