"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { RequireAuth } from "@/components/require-auth";
import { Brand } from "@/components/brand";
import { ExperiencePicker, TopicPicker, TrackPicker } from "@/components/track-pickers";
import {
  CareerDetailsFields,
  CareerStagePicker,
  careerProfilePayload,
  type CareerProfileValue,
} from "@/components/career-profile-fields";
import { BlurText } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { CAREER_STAGE_LABELS, TRACKS, type CareerStage, type ExperienceLevel, type PracticeCategory, type TargetRole } from "@/lib/domain";
import type { Profile } from "@/lib/db";
import { cn } from "@/lib/utils";

const STEPS = ["About you", "Target track", "Experience", "Focus areas"] as const;

function Onboarding() {
  const router = useRouter();
  const toast = useToast();
  const { profile, user, setProfile, signOut } = useAuth();
  const [step, setStep] = useState(0);
  // RequireAuth only renders this once the profile has loaded.
  const [name, setName] = useState(() => profile?.name || user?.displayName || "");
  const [role, setRole] = useState<TargetRole | null>(() => profile?.targetRole ?? null);
  const [level, setLevel] = useState<ExperienceLevel | null>(() => profile?.experienceLevel ?? null);
  const [topics, setTopics] = useState<PracticeCategory[]>(() => profile?.preferredTopics ?? []);
  const [career, setCareer] = useState<CareerProfileValue>(() => ({
    careerStage: profile?.careerStage ?? null,
    organization: profile?.organization ?? "",
    currentTitle: profile?.currentTitle ?? "",
    graduationYear: profile?.graduationYear ? String(profile.graduationYear) : "",
    targetCompanies: profile?.targetCompanies ?? [],
    interviewTimeline: profile?.interviewTimeline ?? null,
    goal: profile?.goal ?? "",
  }));
  const [saving, setSaving] = useState(false);

  // Choosing a career stage pre-selects a sensible experience level (still editable).
  function chooseStage(stage: CareerStage) {
    setCareer((c) => ({ ...c, careerStage: stage }));
    setLevel((current) => current ?? CAREER_STAGE_LABELS[stage].suggestedLevel);
  }

  // Pre-select the track's core areas when a track is first chosen.
  function chooseTrack(next: TargetRole) {
    setRole(next);
    setTopics((current) => (current.length ? current : TRACKS[next].focusCategories.slice(0, 4)));
  }

  const canContinue = [Boolean(career.careerStage), Boolean(role), Boolean(level), topics.length > 0][step];

  async function finish() {
    if (!role || !level) return;
    setSaving(true);
    try {
      const { profile: updated } = await api<{ profile: Profile }>("/api/me", {
        method: "PATCH",
        body: {
          targetRole: role,
          experienceLevel: level,
          preferredTopics: topics,
          ...careerProfilePayload(career),
          ...(name.trim() ? { name: name.trim() } : {}),
        },
      });
      setProfile(updated);
      router.replace("/home");
    } catch (error) {
      toast.error("Couldn't save your preferences", errorMessage(error));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Brand />
        <Button variant="ghost" size="sm" onClick={() => void signOut().then(() => router.replace("/login"))}>
          Sign out
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10 lg:py-14">
        <ol className="flex items-center gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-2">
              <span className={cn("h-0.5 rounded-full", i <= step ? "bg-accent" : "bg-border")} />
              <span className={cn("text-[12px]", i === step ? "text-foreground" : "text-subtle")}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          {step === 0 && (
            <section aria-labelledby="about-heading">
              <h1 id="about-heading" className="text-2xl font-semibold tracking-tight">
                <BlurText text="Welcome to Blackbox." />{" "}
                <BlurText text="Let's get to know you." delayMs={250} className="font-display text-[28px] font-normal italic text-accent" />
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A few details let the interviewer talk to you like a real panel would — about your college or work, the companies you want, and how soon you&apos;re interviewing.
              </p>
              <div className="mt-6 max-w-sm">
                <label htmlFor="name" className="text-[13px] font-medium">
                  Your name
                </label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1.5" placeholder="Your name" />
              </div>
              <h2 className="mt-8 text-[15px] font-semibold">Where are you in your career?</h2>
              <div className="mt-3">
                <CareerStagePicker value={career.careerStage} onChange={chooseStage} />
              </div>
              {career.careerStage && (
                <div className="animate-blur-in mt-8 border-t pt-6">
                  <CareerDetailsFields value={career} onChange={setCareer} />
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="track-heading">
              <h1 id="track-heading" className="text-2xl font-semibold tracking-tight">
                Which role are you <span className="font-display text-[28px] font-normal italic text-accent">preparing for?</span>
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Your track calibrates interview questions, practice recommendations and the metrics on your dashboard. You can change it any time in Settings.
              </p>
              <div className="mt-6">
                <TrackPicker value={role} onChange={chooseTrack} />
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="exp-heading">
              <h1 id="exp-heading" className="text-2xl font-semibold tracking-tight">
                How experienced are you?
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Interviewers adjust depth and expectations to your level — senior candidates get architecture and leadership questions.
              </p>
              <div className="mt-6">
                <ExperiencePicker value={level} onChange={setLevel} />
              </div>
            </section>
          )}

          {step === 3 && role && (
            <section aria-labelledby="topics-heading">
              <h1 id="topics-heading" className="text-2xl font-semibold tracking-tight">
                Where do you want to focus?
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We pre-selected the core areas for the {TRACKS[role].label} track. Add or remove any.
              </p>
              <div className="mt-6">
                <TopicPicker value={topics} onChange={setTopics} highlight={TRACKS[role].focusCategories} />
              </div>
            </section>
          )}
        </div>

        <div className="mt-10 flex items-center justify-between border-t pt-6">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || saving}>
            <ArrowLeft />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continue
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={finish} disabled={!canContinue || saving}>
              {saving && <Spinner className="text-primary-foreground" />}
              Open my dashboard
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth allowIncompleteProfile>
      <Onboarding />
    </RequireAuth>
  );
}
