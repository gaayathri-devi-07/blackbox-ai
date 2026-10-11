"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileUp, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { extractText } from "@/lib/extract-text";
import { cn } from "@/lib/utils";

interface ProjectQuestion {
  question: string;
  focus?: string;
}

interface Review {
  answer: string;
  review: string;
  source: "model" | "heuristic";
}

export default function ProjectReviewPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<ProjectQuestion[] | null>(null);
  const [source, setSource] = useState<"model" | "fallback">("model");
  const [active, setActive] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviews, setReviews] = useState<Record<number, Review>>({});
  const [dragOver, setDragOver] = useState(false);

  async function loadFile(file: File) {
    setExtracting(true);
    try {
      const text = await extractText(file);
      if (text.length < 40) {
        toast.error("Couldn't read enough text from that file", "Paste the project description instead — scanned or compressed PDFs can't be read in the browser.");
        return;
      }
      setDescription(text.slice(0, 20_000));
      setFileName(file.name);
    } catch (error) {
      toast.error("File upload failed", (error as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const res = await api<{ questions: ProjectQuestion[]; source: "model" | "fallback" }>("/api/project", {
        method: "POST",
        timeoutMs: 45_000,
        body: { action: "analyze", projectDescription: description },
      });
      setQuestions(res.questions);
      setSource(res.source);
      setReviews({});
      setActive(0);
      setAnswer("");
    } catch (error) {
      toast.error("Analysis failed", errorMessage(error));
    } finally {
      setAnalyzing(false);
    }
  }

  async function submitAnswer() {
    if (active === null || !questions) return;
    setReviewing(true);
    try {
      const res = await api<{ review: string; source: "model" | "heuristic" }>("/api/project", {
        method: "POST",
        timeoutMs: 45_000,
        body: { action: "answer", projectDescription: description, question: questions[active].question, answer },
      });
      setReviews((r) => ({ ...r, [active]: { answer, review: res.review, source: res.source } }));
    } catch (error) {
      toast.error("Review failed", errorMessage(error));
    } finally {
      setReviewing(false);
    }
  }

  const words = description.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project review"
        title={
          <>
            Defend your work <span className="font-display text-[1.15em] font-normal italic">like the panel will probe it.</span>
          </>
        }
        description="Share a project write-up or README. You'll get the questions an interviewer would use to test depth and ownership, then feedback on your answers."
        actions={
          questions && (
            <Button variant="outline" onClick={() => { setQuestions(null); setActive(null); }}>
              <ArrowLeft /> Edit project
            </Button>
          )
        }
      />

      {!questions ? (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) void loadFile(f);
              }}
              className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors", dragOver && "border-accent bg-accent-soft")}
            >
              <FileUp className="size-5 text-muted-foreground" />
              <p className="text-[13px]">
                Drop a <span className="font-mono">.md</span>, <span className="font-mono">.txt</span> or <span className="font-mono">.pdf</span> file, or{" "}
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => fileRef.current?.click()}>browse</button>
              </p>
              {fileName && <Badge variant="outline">{fileName}</Badge>}
              {extracting && <Spinner />}
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div>
              <label htmlFor="desc" className="text-[13px] font-medium">Or paste the description</label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                maxLength={20_000}
                className="mt-1.5"
                placeholder="What the project does, the architecture and stack, the hardest problems, your role, and results."
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-subtle tabular">{words} words</span>
              <Button onClick={analyze} disabled={analyzing || words < 25}>
                {analyzing && <Spinner className="text-primary-foreground" />}
                Generate interview questions <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <nav aria-label="Questions" className="space-y-1.5">
            {source === "fallback" && (
              <p className="mb-3 flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />Standard project questions shown — configure Gemini for project-specific ones.
              </p>
            )}
            {questions.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setActive(i); setAnswer(reviews[i]?.answer ?? ""); }}
                className={cn("flex w-full gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors", active === i ? "border-accent bg-accent-soft" : "hover:border-border-strong")}
              >
                <span className="font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 leading-5">{q.question}</span>
                {reviews[i] && <Badge variant="success">Done</Badge>}
              </button>
            ))}
          </nav>

          {active !== null && (
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div>
                  {questions[active].focus && <p className="eyebrow">{questions[active].focus}</p>}
                  <p className="mt-1 text-[16px] leading-7">{questions[active].question}</p>
                </div>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={8}
                  maxLength={4000}
                  placeholder="Answer as you would in the room — specific decisions, trade-offs and outcomes."
                />
                <div className="flex justify-end">
                  <Button onClick={submitAnswer} disabled={reviewing || answer.trim().length < 20}>
                    {reviewing && <Spinner className="text-primary-foreground" />}
                    Review my answer
                  </Button>
                </div>
                {reviews[active] && (
                  <div className="rounded-md border bg-background px-4 py-3">
                    <p className="eyebrow mb-2">Interviewer feedback</p>
                    <p className="whitespace-pre-wrap text-[13px] leading-6">{reviews[active].review}</p>
                  </div>
                )}
                {active < questions.length - 1 && reviews[active] && (
                  <div className="flex justify-end">
                    <Button variant="ghost" onClick={() => { setActive(active + 1); setAnswer(reviews[active + 1]?.answer ?? ""); }}>
                      Next question <ArrowRight />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
