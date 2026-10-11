"use client";

import { Check } from "lucide-react";
import {
  CATEGORY_LABELS,
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  PRACTICE_CATEGORIES,
  TARGET_ROLES,
  TRACKS,
  type ExperienceLevel,
  type PracticeCategory,
  type TargetRole,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

export function TrackPicker({ value, onChange }: { value: TargetRole | null; onChange: (role: TargetRole) => void }) {
  return (
    <div role="radiogroup" aria-label="Target track" className="grid gap-3 sm:grid-cols-2">
      {TARGET_ROLES.map((role) => {
        const track = TRACKS[role];
        const selected = value === role;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(role)}
            className={cn(
              "group relative flex flex-col rounded-lg border bg-card p-4 text-left transition-colors",
              selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold">{track.label}</span>
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-accent bg-accent text-accent-foreground" : "border-border-strong"
                )}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
            </div>
            <span className="mt-1 text-[13px] leading-5 text-muted-foreground">{track.summary}</span>
            <span className="mt-3 flex flex-wrap gap-1.5">
              {track.focusCategories.slice(0, 3).map((c) => (
                <span key={c} className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {CATEGORY_LABELS[c]}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ExperiencePicker({
  value,
  onChange,
}: {
  value: ExperienceLevel | null;
  onChange: (level: ExperienceLevel) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Experience level" className="divide-y overflow-hidden rounded-lg border bg-card">
      {EXPERIENCE_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(level)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
              selected ? "bg-accent-soft" : "hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-accent bg-accent" : "border-border-strong"
              )}
            >
              {selected && <span className="size-1.5 rounded-full bg-accent-foreground" />}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{EXPERIENCE_LABELS[level].label}</span>
              <span className="block text-[13px] text-muted-foreground">{EXPERIENCE_LABELS[level].detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TopicPicker({
  value,
  onChange,
  highlight = [],
}: {
  value: PracticeCategory[];
  onChange: (topics: PracticeCategory[]) => void;
  highlight?: PracticeCategory[];
}) {
  const toggle = (c: PracticeCategory) =>
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Preferred topics">
      {PRACTICE_CATEGORIES.map((c) => {
        const selected = value.includes(c);
        return (
          <button
            key={c}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(c)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors",
              selected ? "border-accent bg-accent-soft text-foreground" : "text-muted-foreground hover:border-border-strong hover:text-foreground"
            )}
          >
            {selected && <Check className="size-3.5 text-accent" />}
            {CATEGORY_LABELS[c]}
            {highlight.includes(c) && !selected && <span className="text-[10px] text-subtle">· core</span>}
          </button>
        );
      })}
    </div>
  );
}
