"use client";

import { useState } from "react";
import { Briefcase, Check, Compass, GraduationCap, Plus, RefreshCw, Repeat, School, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/primitives";
import {
  CAREER_STAGES,
  CAREER_STAGE_LABELS,
  INTERVIEW_TIMELINES,
  POPULAR_COMPANIES,
  TIMELINE_LABELS,
  type CareerStage,
  type InterviewTimeline,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface CareerProfileValue {
  careerStage: CareerStage | null;
  organization: string;
  currentTitle: string;
  graduationYear: string;
  targetCompanies: string[];
  interviewTimeline: InterviewTimeline | null;
  goal: string;
}

export const EMPTY_CAREER_PROFILE: CareerProfileValue = {
  careerStage: null,
  organization: "",
  currentTitle: "",
  graduationYear: "",
  targetCompanies: [],
  interviewTimeline: null,
  goal: "",
};

/** Build the API payload; empty strings clear optional fields. */
export function careerProfilePayload(v: CareerProfileValue) {
  const year = Number.parseInt(v.graduationYear, 10);
  return {
    careerStage: v.careerStage,
    organization: v.organization.trim(),
    currentTitle: v.currentTitle.trim(),
    graduationYear: Number.isFinite(year) && year >= 1970 && year <= 2040 ? year : null,
    targetCompanies: v.targetCompanies,
    interviewTimeline: v.interviewTimeline,
    goal: v.goal.trim(),
  };
}

const STAGE_ICON: Record<CareerStage, typeof School> = {
  STUDENT: School,
  RECENT_GRADUATE: GraduationCap,
  WORKING_PROFESSIONAL: Briefcase,
  CAREER_SWITCHER: Repeat,
  BETWEEN_JOBS: RefreshCw,
};

export function CareerStagePicker({ value, onChange }: { value: CareerStage | null; onChange: (stage: CareerStage) => void }) {
  return (
    <div role="radiogroup" aria-label="Where you are in your career" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {CAREER_STAGES.map((stage, i) => {
        const Icon = STAGE_ICON[stage];
        const selected = value === stage;
        return (
          <button
            key={stage}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(stage)}
            style={{ animationDelay: `${i * 50}ms` }}
            className={cn(
              "animate-pop-in lift flex items-start gap-3 rounded-lg border bg-card p-3.5 text-left",
              selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
            )}
          >
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", selected ? "bg-accent text-accent-foreground" : "bg-accent-soft text-accent")}>
              <Icon className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{CAREER_STAGE_LABELS[stage].label}</span>
              <span className="mt-0.5 block text-[12.5px] leading-5 text-muted-foreground">{CAREER_STAGE_LABELS[stage].detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CompanyPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (name: string) => {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!clean || value.some((v) => v.toLowerCase() === clean.toLowerCase()) || value.length >= 10) return;
    onChange([...value, clean]);
  };
  const remove = (name: string) => onChange(value.filter((v) => v !== name));
  const suggestions = POPULAR_COMPANIES.filter((c) => !value.includes(c));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        {value.map((c) => (
          <span key={c} className="animate-pop-in inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2.5 pr-1 text-[12.5px] font-medium text-accent">
            {c}
            <button type="button" onClick={() => remove(c)} className="rounded-full p-0.5 hover:bg-accent/15" aria-label={`Remove ${c}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="target-companies"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim()) {
              add(draft);
              setDraft("");
            }
          }}
          placeholder={value.length ? "Add another…" : "Type a company and press Enter"}
          className="h-7 min-w-40 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
        />
      </div>
      {suggestions.length > 0 && value.length < 10 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 12).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => add(c)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground"
            >
              <Plus className="size-3" />
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelinePicker({ value, onChange }: { value: InterviewTimeline | null; onChange: (t: InterviewTimeline) => void }) {
  return (
    <div role="radiogroup" aria-label="When are your interviews" className="grid gap-2 sm:grid-cols-4">
      {INTERVIEW_TIMELINES.map((t) => {
        const selected = value === t;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t)}
            className={cn(
              "rounded-md border bg-card px-3 py-2 text-left transition-colors",
              selected ? "border-accent bg-accent-soft" : "hover:border-border-strong"
            )}
          >
            <span className="flex items-center justify-between text-[13px] font-medium">
              {TIMELINE_LABELS[t].label}
              {selected && <Check className="size-3.5 text-accent" />}
            </span>
            <span className="block text-[11.5px] leading-4 text-muted-foreground">{TIMELINE_LABELS[t].detail}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Organisation, title, graduation year, target companies, timeline and goal. */
export function CareerDetailsFields({ value, onChange }: { value: CareerProfileValue; onChange: (next: CareerProfileValue) => void }) {
  const stage = value.careerStage ? CAREER_STAGE_LABELS[value.careerStage] : null;
  const showYear = value.careerStage === "STUDENT" || value.careerStage === "RECENT_GRADUATE";
  const set = <K extends keyof CareerProfileValue>(key: K, v: CareerProfileValue[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-5">
      <div className={cn("grid gap-4", showYear ? "sm:grid-cols-[1fr_1fr_8rem]" : "sm:grid-cols-2")}>
        <div>
          <label htmlFor="organization" className="text-[13px] font-medium">
            {stage?.organization ?? "College or company"} <span className="font-normal text-subtle">(optional)</span>
          </label>
          <Input id="organization" value={value.organization} onChange={(e) => set("organization", e.target.value)} maxLength={120} className="mt-1.5" placeholder={value.careerStage === "STUDENT" || value.careerStage === "RECENT_GRADUATE" ? "IIT Madras" : "Infosys"} />
        </div>
        <div>
          <label htmlFor="current-title" className="text-[13px] font-medium">
            {stage?.title ?? "Degree or job title"} <span className="font-normal text-subtle">(optional)</span>
          </label>
          <Input id="current-title" value={value.currentTitle} onChange={(e) => set("currentTitle", e.target.value)} maxLength={120} className="mt-1.5" placeholder={stage?.titlePlaceholder ?? "B.Tech, Computer Science"} />
        </div>
        {showYear && (
          <div>
            <label htmlFor="grad-year" className="text-[13px] font-medium">
              Graduation
            </label>
            <Input
              id="grad-year"
              inputMode="numeric"
              value={value.graduationYear}
              onChange={(e) => set("graduationYear", e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-1.5"
              placeholder="2027"
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="target-companies" className="text-[13px] font-medium">
          Companies you&apos;re aiming for <span className="font-normal text-subtle">(optional)</span>
        </label>
        <p className="mb-1.5 text-[12px] text-muted-foreground">Interviewers mirror these companies&apos; styles and expectations.</p>
        <CompanyPicker value={value.targetCompanies} onChange={(v) => set("targetCompanies", v)} />
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-medium">
          <Compass className="mr-1 inline size-3.5 text-accent" />
          When are your interviews?
        </p>
        <TimelinePicker value={value.interviewTimeline} onChange={(t) => set("interviewTimeline", t)} />
      </div>

      <div>
        <label htmlFor="goal" className="text-[13px] font-medium">
          What do you want from Blackbox? <span className="font-normal text-subtle">(optional)</span>
        </label>
        <Textarea
          id="goal"
          value={value.goal}
          onChange={(e) => set("goal", e.target.value)}
          maxLength={400}
          className="mt-1.5 min-h-20"
          placeholder="e.g. Get comfortable with system design rounds and stop freezing in HR interviews."
        />
      </div>
    </div>
  );
}
