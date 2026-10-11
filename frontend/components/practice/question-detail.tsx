"use client";

import { useState } from "react";
import { BookOpen, Check, Lightbulb, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentedControl, Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import type { PracticeQuestionDTO, PracticeStatus } from "./types";
import { cn } from "@/lib/utils";

type Tab = "points" | "model" | "weak" | "why";

interface AttemptEvaluation {
  score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  source: "model" | "heuristic";
}

export function QuestionDetail({
  question,
  onStatusChange,
  onAskCoach,
}: {
  question: PracticeQuestionDTO;
  onStatusChange: (status: PracticeStatus) => void;
  onAskCoach: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(() => (question.keyPoints.length ? "points" : "model"));
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [evaluation, setEvaluation] = useState<AttemptEvaluation | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  async function setStatus(status: PracticeStatus) {
    setSavingStatus(true);
    try {
      const res = await api<{ status: PracticeStatus }>("/api/practice", {
        method: "POST",
        body: { action: "progress", questionId: question.id, status },
      });
      onStatusChange(res.status);
    } catch (error) {
      toast.error("Couldn't update progress", errorMessage(error));
    } finally {
      setSavingStatus(false);
    }
  }

  async function grade() {
    setGrading(true);
    try {
      const res = await api<{ evaluation: AttemptEvaluation; status: PracticeStatus }>("/api/practice", {
        method: "POST",
        body: { action: "evaluate", questionId: question.id, answer },
        timeoutMs: 40_000,
      });
      setEvaluation(res.evaluation);
      onStatusChange(res.status);
      setTab("model");
    } catch (error) {
      toast.error("Grading failed", errorMessage(error));
    } finally {
      setGrading(false);
    }
  }

  const tabs: { value: Tab; label: string }[] = [
    ...(question.keyPoints.length ? [{ value: "points" as const, label: "Key points" }] : []),
    { value: "model", label: "Model answer" },
    ...(question.weakAnswer ? [{ value: "weak" as const, label: "Weak answer" }] : []),
    ...(question.explanation ? [{ value: "why" as const, label: "Why it matters" }] : []),
  ];

  return (
    <div className="border-t bg-background/40 px-4 pb-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<Tab> ariaLabel="Answer view" value={tab} onChange={setTab} options={tabs} />
        <div className="flex flex-wrap gap-1.5">
          {question.tags.slice(0, 4).map((t) => (
            <span key={t} className="font-mono text-[11px] text-subtle">#{t}</span>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "mt-3 rounded-md border px-4 py-3.5 text-[14px] leading-7",
          tab === "weak" ? "border-danger/20 bg-danger-soft/50" : "bg-card"
        )}
      >
        {tab === "points" && (
          <>
            <p className="eyebrow mb-2">A strong answer covers</p>
            <ul className="space-y-2">
              {question.keyPoints.map((k, i) => (
                <li key={k} className="animate-blur-in flex gap-2.5 text-[14px] leading-6" style={{ animationDelay: `${i * 70}ms` }}>
                  <BookOpen className="mt-1.5 size-3.5 shrink-0 text-accent" />
                  {k}
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === "model" && <p className="animate-blur-in whitespace-pre-line">{question.sampleAnswer}</p>}
        {tab === "weak" && (
          <>
            <p className="eyebrow mb-1 text-danger">What a weak answer sounds like</p>
            <p className="text-muted-foreground">{question.weakAnswer}</p>
          </>
        )}
        {tab === "why" && <p>{question.explanation}</p>}
      </div>

      {question.tip && (
        <p className="mt-3 flex gap-2 text-[13px] leading-5 text-muted-foreground">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" />
          {question.tip}
        </p>
      )}

      {evaluation && (
        <div className="mt-4 rounded-md border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Your attempt</p>
            <span className="font-mono text-lg font-semibold tabular">
              {evaluation.score}
              <span className="text-xs text-muted-foreground">/100</span>
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">{evaluation.verdict}</p>
          {evaluation.strengths.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px]">
              {evaluation.strengths.map((s) => (
                <li key={s} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-success" />{s}</li>
              ))}
            </ul>
          )}
          {evaluation.gaps.length > 0 && (
            <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
              {evaluation.gaps.map((g) => (
                <li key={g} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-warning" />{g}</li>
              ))}
            </ul>
          )}
          {evaluation.source === "heuristic" && (
            <p className="mt-3 text-[11px] text-subtle">Scored with the offline rubric. Configure Gemini for content-level grading.</p>
          )}
        </div>
      )}

      {attemptOpen && (
        <div className="mt-4 space-y-2">
          <label htmlFor={`attempt-${question.id}`} className="text-[13px] font-medium">
            Your answer
          </label>
          <Textarea
            id={`attempt-${question.id}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Answer as you would in the interview. Aim for a concrete example and a measurable result."
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-subtle tabular">{answer.trim().split(/\s+/).filter(Boolean).length} words</span>
            <Button size="sm" onClick={grade} disabled={grading || answer.trim().length < 20}>
              {grading && <Spinner className="text-primary-foreground" />}
              Grade my answer
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        {!attemptOpen && (
          <Button size="sm" onClick={() => setAttemptOpen(true)}>
            Attempt this question
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onAskCoach}>
          <MessageSquare /> Ask the coach
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {savingStatus && <Spinner />}
          <span className="text-[12px] text-muted-foreground">Mark as</span>
          <Button
            size="sm"
            variant={question.status === "REVIEWED" ? "secondary" : "ghost"}
            onClick={() => setStatus(question.status === "REVIEWED" ? null : "REVIEWED")}
            disabled={savingStatus}
            aria-pressed={question.status === "REVIEWED"}
          >
            Reviewed
          </Button>
          <Button
            size="sm"
            variant={question.status === "CONFIDENT" ? "secondary" : "ghost"}
            onClick={() => setStatus(question.status === "CONFIDENT" ? null : "CONFIDENT")}
            disabled={savingStatus}
            aria-pressed={question.status === "CONFIDENT"}
          >
            {question.status === "CONFIDENT" && <Check className="text-success" />}
            Confident
          </Button>
        </div>
      </div>
    </div>
  );
}
