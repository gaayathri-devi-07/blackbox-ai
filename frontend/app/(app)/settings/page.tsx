"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { AlertTriangle, AudioLines, Check, Languages, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, Target, Trash2, UserRound } from "lucide-react";
import { PrivacyPanel } from "@/components/privacy-panel";
import { useAuth } from "@/components/providers/auth-provider";
import {
  CareerDetailsFields,
  CareerStagePicker,
  careerProfilePayload,
  type CareerProfileValue,
} from "@/components/career-profile-fields";
import { ExperiencePicker, TopicPicker, TrackPicker } from "@/components/track-pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, ProgressBar, Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { TRACKS, type ExperienceLevel, type PracticeCategory, type TargetRole } from "@/lib/domain";
import type { Profile } from "@/lib/db";
import { SPEECH_LANGS, getSpeechLang, setSpeechLang } from "@/lib/speech";
import {
  TRANSCRIPTION_OPTIONS,
  getTranscriptionQuality,
  localTranscriber,
  setTranscriptionQuality,
  useLocalTranscriber,
  type TranscriptionQuality,
} from "@/lib/transcription";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "career", label: "Career background", icon: Target },
  { id: "track", label: "Track & focus", icon: Target },
  { id: "speech", label: "Interview & speech", icon: AudioLines },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy & AI", icon: ShieldCheck },
  { id: "session", label: "Log out", icon: LogOut },
  { id: "danger", label: "Delete account", icon: Trash2 },
] as const;

function careerFromProfile(p: Profile | null): CareerProfileValue {
  return {
    careerStage: p?.careerStage ?? null,
    organization: p?.organization ?? "",
    currentTitle: p?.currentTitle ?? "",
    graduationYear: p?.graduationYear ? String(p.graduationYear) : "",
    targetCompanies: p?.targetCompanies ?? [],
    interviewTimeline: p?.interviewTimeline ?? null,
    goal: p?.goal ?? "",
  };
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-xl border bg-card shadow-panel">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="border-l-2 border-module pl-3 text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 pl-3.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

const noopSubscribe = () => () => undefined;
/** True after hydration; device preferences come from localStorage, which the server can't read. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function SettingsPage() {
  const { profile, user, setProfile, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  const transcriber = useLocalTranscriber();

  // Account settings (saved to the server).
  const [name, setName] = useState(() => profile?.name ?? "");
  const [career, setCareer] = useState<CareerProfileValue>(() => careerFromProfile(profile));
  const [role, setRole] = useState<TargetRole | null>(() => profile?.targetRole ?? null);
  const [level, setLevel] = useState<ExperienceLevel | null>(() => profile?.experienceLevel ?? null);
  const [topics, setTopics] = useState<PracticeCategory[]>(() => profile?.preferredTopics ?? []);
  const [saving, setSaving] = useState(false);

  // Device settings (saved in this browser).
  const [accent, setAccent] = useState("en-US");
  const [quality, setQuality] = useState<TranscriptionQuality>("standard");
  useEffect(() => {
    const a = getSpeechLang();
    const q = getTranscriptionQuality();
    queueMicrotask(() => {
      setAccent(a);
      setQuality(q);
    });
  }, []);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const original = careerFromProfile(profile);
  const dirty =
    Boolean(profile) &&
    (name.trim() !== (profile?.name ?? "") ||
      role !== profile?.targetRole ||
      level !== profile?.experienceLevel ||
      [...topics].sort().join() !== [...(profile?.preferredTopics ?? [])].sort().join() ||
      JSON.stringify(careerProfilePayload(career)) !== JSON.stringify(careerProfilePayload(original)));

  async function save() {
    if (!role || !level || !career.careerStage) return;
    setSaving(true);
    try {
      const res = await api<{ profile: Profile }>("/api/me", {
        method: "PATCH",
        body: {
          targetRole: role,
          experienceLevel: level,
          preferredTopics: topics,
          ...careerProfilePayload(career),
          ...(name.trim() ? { name: name.trim() } : {}),
        },
      });
      setProfile(res.profile);
      toast.success(
        "Settings saved",
        role !== profile?.targetRole ? `Your dashboard and interviews are now calibrated for ${TRACKS[role].label}.` : undefined
      );
    } catch (error) {
      toast.error("Couldn't save settings", errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api<{ deleted: true }>("/api/me", { method: "DELETE" });
      await signOut();
      router.replace("/login");
    } catch (error) {
      toast.error("Couldn't delete your account", errorMessage(error));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, career goals, interview preferences and appearance. Account details sync across devices; speech settings apply to this browser."
      />

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <s.icon className="size-3.5" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-5">
          <Section id="profile" title="Profile" description="How you appear in the app.">
            <div className="grid max-w-xl gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="text-[13px] font-medium">Display name</label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="mt-1.5" />
              </div>
              <div>
                <p className="text-[13px] font-medium">Signed in with</p>
                <p className="mt-2.5 truncate text-[13px] text-muted-foreground">
                  {profile?.email ?? user?.email ?? "Phone number"}
                  {user?.isDemo ? " · local demo account" : ""}
                </p>
              </div>
            </div>
          </Section>

          <Section id="career" title="Career background" description="Interviewers use this to tailor questions and conversation.">
            <CareerStagePicker value={career.careerStage} onChange={(stage) => setCareer({ ...career, careerStage: stage })} />
            <div className="mt-6 border-t pt-6">
              <CareerDetailsFields value={career} onChange={setCareer} />
            </div>
          </Section>

          <Section id="track" title="Track & focus" description="Changing your track recalibrates interview questions, practice recommendations and dashboard metrics. Your history is kept.">
            <TrackPicker value={role} onChange={setRole} />
            <h3 className="mt-6 text-[13px] font-semibold">Experience level</h3>
            <div className="mt-2 max-w-xl">
              <ExperiencePicker value={level} onChange={setLevel} />
            </div>
            <h3 className="mt-6 text-[13px] font-semibold">Focus areas</h3>
            <div className="mt-2">
              <TopicPicker value={topics} onChange={setTopics} highlight={role ? TRACKS[role].focusCategories : []} />
            </div>
          </Section>

          <Section id="speech" title="Interview & speech" description="Saved in this browser, because microphones and voices differ between devices.">
            <div className="grid gap-6">
              <div className="max-w-sm">
                <label htmlFor="accent" className="flex items-center gap-1.5 text-[13px] font-medium">
                  <Languages className="size-3.5 text-accent" /> Your accent
                </label>
                <select
                  id="accent"
                  value={accent}
                  disabled={!mounted}
                  onChange={(e) => {
                    setAccent(e.target.value);
                    setSpeechLang(e.target.value);
                    toast.success("Accent saved");
                  }}
                  className="mt-1.5 h-9 w-full rounded-md border bg-background px-2.5 text-[13px]"
                >
                  {SPEECH_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-[13px] font-medium">
                  <AudioLines className="size-3.5 text-accent" /> Transcription accuracy
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Live captions appear while you speak. When you finish, your answer is transcribed again with Whisper running on your device — your voice never leaves your computer — and you can review and edit it before submitting.
                </p>
                <div role="radiogroup" aria-label="Transcription accuracy" className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  {(Object.keys(TRANSCRIPTION_OPTIONS) as TranscriptionQuality[]).map((q) => {
                    const selected = quality === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!mounted}
                        onClick={() => {
                          setQuality(q);
                          setTranscriptionQuality(q);
                        }}
                        className={cn("rounded-lg border bg-background p-3 text-left transition-colors", selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong")}
                      >
                        <span className="flex items-center justify-between text-[13px] font-semibold">
                          {TRANSCRIPTION_OPTIONS[q].label}
                          {selected && <Check className="size-3.5 text-accent" />}
                        </span>
                        <span className="mt-1 block text-[12px] leading-5 text-muted-foreground">{TRANSCRIPTION_OPTIONS[q].detail}</span>
                      </button>
                    );
                  })}
                </div>
                {quality !== "off" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
                    {transcriber.status === "ready" ? (
                      <span className="inline-flex items-center gap-1.5 text-success"><Check className="size-3.5" /> Model downloaded and ready</span>
                    ) : transcriber.status === "loading" ? (
                      <span className="flex min-w-60 items-center gap-2 text-muted-foreground">
                        <Spinner className="size-3.5" /> Downloading {transcriber.progress}%
                        <ProgressBar value={transcriber.progress} className="w-32" label="Model download" />
                      </span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => localTranscriber.prepare()}>
                        Download now ({TRANSCRIPTION_OPTIONS[quality].sizeMb} MB)
                      </Button>
                    )}
                    {transcriber.status === "error" && <span className="text-danger">{transcriber.error}</span>}
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section id="appearance" title="Appearance" description="Choose how Blackbox looks on this device.">
            <div role="radiogroup" aria-label="Theme" className="grid max-w-lg grid-cols-3 gap-2.5">
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ].map((t) => {
                const selected = mounted && theme === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTheme(t.value)}
                    className={cn("flex flex-col items-center gap-2 rounded-lg border bg-background p-3 text-[13px] font-medium transition-colors", selected ? "border-accent ring-1 ring-accent" : "hover:border-border-strong")}
                  >
                    <t.icon className={cn("size-4", selected ? "text-accent" : "text-muted-foreground")} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section id="privacy" title="Privacy & AI" description="What protects your data when AI features run, and how often they ran for you.">
            <PrivacyPanel />
          </Section>

          <Section id="session" title="Log out" description="Sign out of Blackbox on this device.">
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              <LogOut /> Log out
            </Button>
          </Section>

          <Section id="danger" title="Delete account" description="Permanent and immediate.">
            <div className="max-w-xl rounded-lg border border-danger/25 p-4">
              <p className="flex gap-2 text-[13px] leading-6 text-muted-foreground">
                <AlertTriangle className="mt-1 size-4 shrink-0 text-danger" />
                Removes your profile, interview transcripts and reports, group-discussion records, practice progress and coach conversations. Your Google, GitHub or phone identity is not affected.
              </p>
              {!confirmingDelete ? (
                <Button variant="outline" className="mt-4 border-danger/40 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmingDelete(true)}>
                  Delete my account
                </Button>
              ) : (
                <div className="mt-4 space-y-3">
                  <label htmlFor="confirm-delete" className="text-[13px] font-medium">
                    Type <span className="font-mono">DELETE</span> to confirm
                  </label>
                  <Input id="confirm-delete" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" className="max-w-xs" />
                  <div className="flex gap-2">
                    <Button variant="destructive" disabled={deleteText !== "DELETE" || deleting} onClick={deleteAccount}>
                      {deleting && <Spinner className="text-white" />}
                      Permanently delete
                    </Button>
                    <Button variant="ghost" disabled={deleting} onClick={() => { setConfirmingDelete(false); setDeleteText(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {dirty && (
        <div className="animate-pop-in fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(560px,calc(100%-2rem))] items-center justify-between gap-3 rounded-xl border bg-popover px-4 py-3 shadow-xl">
          <p className="text-[13px] font-medium">You have unsaved changes</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setName(profile?.name ?? "");
                setCareer(careerFromProfile(profile));
                setRole(profile?.targetRole ?? null);
                setLevel(profile?.experienceLevel ?? null);
                setTopics(profile?.preferredTopics ?? []);
              }}
            >
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !role || !level || !career.careerStage || topics.length === 0}>
              {saving && <Spinner className="text-primary-foreground" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
