"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Play, Volume2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Skeleton, Textarea } from "@/components/ui/primitives";
import { JD_STORAGE_KEY } from "@/lib/job-description";
import {
  COMPANIES,
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  INTERVIEW_MODES,
  MODE_LABELS,
  TRACKS,
  getCompany,
  type ExperienceLevel,
  type InterviewMode,
} from "@/lib/domain";
import { guessVoiceGender, loadVoices, pickVoice, speak, voiceQuality } from "@/lib/speech";
import { cn } from "@/lib/utils";

function Setup() {
  const params = useSearchParams();
  const { profile } = useAuth();
  const track = profile?.targetRole ? TRACKS[profile.targetRole] : null;

  const initialMode = INTERVIEW_MODES.includes(params.get("mode") as InterviewMode) ? (params.get("mode") as InterviewMode) : "STANDARD";
  const [companyId, setCompanyId] = useState(COMPANIES[0].id);
  const [mode, setMode] = useState<InterviewMode>(initialMode);
  const [experience, setExperience] = useState<ExperienceLevel>(profile?.experienceLevel ?? "MID");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // null = use the default voice for the selected interviewer.
  const [chosenVoice, setChosenVoice] = useState<string | null>(null);
  const company = getCompany(companyId);
  const [jobDescription, setJobDescription] = useState("");

  useEffect(() => {
    void loadVoices().then((v) => setVoices(v.filter((x) => x.lang.toLowerCase().startsWith("en"))));
  }, []);

  const voiceName = chosenVoice ?? pickVoice(voices, null, company.interviewer.voice)?.name ?? "";

  const sortedVoices = useMemo(
    () =>
      [...voices].sort((a, b) => {
        // Matching gender first, then the most natural-sounding voices.
        const gender = (v: SpeechSynthesisVoice) => (guessVoiceGender(v.name) === company.interviewer.voice ? 0 : 1);
        return gender(a) - gender(b) || voiceQuality(b) - voiceQuality(a) || a.name.localeCompare(b.name);
      }),
    [voices, company.interviewer.voice]
  );

  function begin() {
    // The job description is too long for a URL; the session page reads it once.
    try {
      if (jobDescription.trim()) window.sessionStorage.setItem(JD_STORAGE_KEY, jobDescription.trim().slice(0, 8000));
      else window.sessionStorage.removeItem(JD_STORAGE_KEY);
    } catch {
      /* storage unavailable: interview runs untailored */
    }
    const q = new URLSearchParams({ company: company.id, mode, experience });
    if (voiceName) q.set("voice", voiceName);
    // A full page load (not client navigation) applies the session page's cross-origin
    // isolation headers, which let on-device transcription use several CPU threads.
    window.location.assign(`/interview/session?${q}`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Mock interview"
        title="Configure your interview loop"
        description={`Five questions calibrated to the ${track?.label ?? "selected"} track, asked aloud by an AI interviewer. Answer by voice or keyboard.`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section aria-labelledby="company-heading">
            <h2 id="company-heading" className="text-sm font-medium">Interview style</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Each style changes the interviewer&apos;s emphasis and how hard they push on follow-ups.</p>
            <div role="radiogroup" aria-labelledby="company-heading" className="mt-3 grid gap-2 sm:grid-cols-2">
              {COMPANIES.map((c) => {
                const selected = c.id === companyId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setCompanyId(c.id);
                      setChosenVoice(null);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border bg-card p-3.5 text-left transition-colors",
                      selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted font-mono text-[11px] font-semibold">
                      {c.monogram}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                        {c.name}
                        {selected && <Check className="size-3.5 text-accent" />}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted-foreground">{c.emphasis}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="mode-heading">
            <h2 id="mode-heading" className="text-sm font-medium">Format</h2>
            <div role="radiogroup" aria-labelledby="mode-heading" className="mt-3 grid gap-2 sm:grid-cols-3">
              {INTERVIEW_MODES.map((m) => {
                const selected = m === mode;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-lg border bg-card p-3.5 text-left transition-colors",
                      selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
                    )}
                  >
                    <span className="text-[13px] font-medium">{MODE_LABELS[m].label}</span>
                    <span className="mt-1 block text-[12px] leading-5 text-muted-foreground">{MODE_LABELS[m].detail}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="jd-heading">
            <label id="jd-heading" htmlFor="job-description" className="text-sm font-medium">
              Tailor to a job <span className="font-normal text-subtle">(optional)</span>
            </label>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Paste a job description and the interviewer asks about its responsibilities and required skills. Personal details in it are masked before any AI sees it.
            </p>
            <Textarea
              id="job-description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              maxLength={8000}
              placeholder="e.g. We're hiring an AI Engineer to build retrieval-augmented assistants… Requirements: Python, vector databases, LLM evaluation…"
              className="mt-3 min-h-28 bg-card"
            />
            {jobDescription.trim() && (
              <p className="mt-1.5 text-[12px] text-muted-foreground">{jobDescription.trim().length.toLocaleString()} / 8,000 characters · questions will follow this role</p>
            )}
          </section>

          <section aria-labelledby="level-heading" className="grid gap-6 sm:grid-cols-2">
            <div>
              <label id="level-heading" htmlFor="level" className="text-sm font-medium">Seniority</label>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Sets the depth of technical and leadership questions.</p>
              <select
                id="level"
                value={experience}
                onChange={(e) => setExperience(e.target.value as ExperienceLevel)}
                className="mt-3 h-9 w-full rounded-md border border-input bg-card px-2.5 text-[13px]"
              >
                {EXPERIENCE_LEVELS.map((l) => (
                  <option key={l} value={l}>{EXPERIENCE_LABELS[l].label} — {EXPERIENCE_LABELS[l].detail}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="voice" className="text-sm font-medium">Interviewer voice</label>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Uses your browser&apos;s built-in voices.</p>
              <div className="mt-3 flex gap-2">
                <select
                  id="voice"
                  value={voiceName}
                  onChange={(e) => setChosenVoice(e.target.value)}
                  disabled={!voices.length}
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 text-[13px] disabled:opacity-60"
                >
                  {!voices.length && <option value="">System default</option>}
                  {sortedVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                      {voiceQuality(v) >= 50 ? " — natural" : ""}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Preview voice"
                  title="Preview voice"
                  onClick={() =>
                    void speak(`Hello, I'm ${company.interviewer.name}. Let's get started.`, {
                      voice: voices.find((v) => v.name === voiceName) ?? null,
                    })
                  }
                >
                  <Play />
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Session brief</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[13px]">
              <dl className="space-y-2.5">
                {[
                  ["Track", track?.label ?? "—"],
                  ["Interviewer", `${company.interviewer.name}, ${company.interviewer.title}`],
                  ["Format", MODE_LABELS[mode].label],
                  ["Seniority", EXPERIENCE_LABELS[experience].label],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t pt-4 leading-5 text-muted-foreground">{company.style}</p>
              <ul className="space-y-1.5 border-t pt-4 text-muted-foreground">
                <li className="flex gap-2"><Volume2 className="mt-0.5 size-3.5 shrink-0" />Questions are read aloud; turn up your volume.</li>
                <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0" />Camera is optional; it enables eye-contact and posture signals.</li>
                <li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0" />The full transcript and scores are saved to your record.</li>
              </ul>
              <Button className="w-full" onClick={begin}>
                Enter interview room <ArrowRight />
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function InterviewSetupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Setup />
    </Suspense>
  );
}
