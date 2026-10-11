"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Mic,
  ShieldCheck,
  Users,
  Video,
  WifiOff,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { BlurText, Reveal } from "@/components/motion";
import { TARGET_ROLES, TRACKS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import heroImage from "@/public/images/login-hero.webp";
import { LoginButton, LoginDialogProvider } from "./login-dialog";

/** "Bridge the gap between ___ and ___" — the pairs rotate in the hero headline. */
const GAPS: [string, string][] = [
  ["practice", "performance"],
  ["nerves", "confidence"],
  ["knowing it", "saying it"],
  ["campus", "career"],
  ["preparation", "the offer"],
];

const NAV = [
  { href: "#crossing", label: "How it works" },
  { href: "#inside", label: "Inside" },
  { href: "#different", label: "Why Blackbox" },
  { href: "#tracks", label: "Tracks" },
];

/** Ink-on-photograph wordmark: the hero ignores the app theme. */
function HeroBrand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-(--hero-ink)">
      <svg viewBox="0 0 24 24" aria-hidden className="size-6">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" />
        <rect x="7" y="7" width="10" height="10" rx="1.5" fill="none" stroke="white" strokeWidth="1.75" />
      </svg>
      <span className="text-[17px] font-medium tracking-tight">Blackbox</span>
    </span>
  );
}

/** Cycles through the gap pairs, blurring each phrase out and the next one in. */
function RotatingGap() {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let swap: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      setLeaving(true);
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % GAPS.length);
        setLeaving(false);
      }, 420);
    }, 3600);
    return () => {
      clearInterval(timer);
      clearTimeout(swap);
    };
  }, []);

  const [from, to] = GAPS[index];
  return (
    <span className="block">
      <span className="sr-only">Bridge the gap between practice and performance.</span>
      <span aria-hidden className="block">
        <span className="block">
          <span className="text-(--hero-ink)/70">between </span>
          <span key={`a${index}`} className={cn("gap-word font-display italic text-(--hero-ink)", leaving && "gap-word-out")}>
            {from}
          </span>
        </span>
        <span className="block">
          <span className="text-(--hero-ink)/70">and </span>
          <span
            key={`b${index}`}
            className={cn("gap-word font-display italic text-(--hero-sage)", leaving && "gap-word-out")}
            style={{ animationDelay: leaving ? "60ms" : "140ms" }}
          >
            {to}
          </span>
        </span>
      </span>
    </span>
  );
}

const CROSSING = [
  {
    step: "01",
    title: "Where you are",
    body: "Answers you know but can't say crisply, stories without structure, and blind spots no one has pointed out. Blackbox starts by asking where you are in your career and where you want to go.",
  },
  {
    step: "02",
    title: "The bridge",
    body: "Mock interviews that follow up like a real panel, group discussions with strict floor control, and a practice bank with model answers — every session scored against a written rubric.",
  },
  {
    step: "03",
    title: "Where you're going",
    body: "Calm, structured answers under pressure, and a record that shows you're ready: readiness score, trends, and a short list of what to study next.",
  },
];

const DIFFERENT = [
  {
    icon: Users,
    title: "Group discussions, not just interviews",
    body: "Four AI panelists with distinct personalities and real turn-taking — the placement round most tools ignore.",
  },
  {
    icon: Cpu,
    title: "Transcribed on your device",
    body: "Whisper runs in your browser, so your recorded answers never leave your computer. Edit the transcript before you submit.",
  },
  {
    icon: AudioLines,
    title: "Voices that pause and react",
    body: "Interviewers warm up, hesitate, encourage and push back — delivery shaped by emotion, not read-aloud text.",
  },
  {
    icon: BrainCircuit,
    title: "Grounded, agentic coaching",
    body: "Feedback cites a curated knowledge base, and a planning agent turns your weak spots into this week's plan.",
  },
  {
    icon: WifiOff,
    title: "Works with or without AI",
    body: "Live Gemini when you're online; a 500-question bank with rubric scoring when you're not. Never a dead end.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Emails, phone numbers and IDs are masked before any text reaches a model or a log. Camera frames never leave the browser.",
  },
];

function InterviewMock() {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-panel">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[12px] font-medium">
          <span className="flex size-6 items-center justify-center rounded-md bg-mod-interview/12 text-mod-interview ring-1 ring-mod-interview/25">
            <Video className="size-3.5" />
          </span>
          Mock interview · Question 3 of 5
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-0.5 text-[10.5px] font-medium text-danger">
          <span className="size-1.5 animate-pulse rounded-full bg-danger" /> Listening
        </span>
      </div>
      <p className="mt-4 rounded-xl bg-muted p-3 text-[13px] leading-5">
        <span className="font-medium">Priya (interviewer):</span> That&apos;s a good start. How would you keep retrieval quality from drifting once the index grows?
      </p>
      <div className="mt-3 rounded-xl border border-dashed p-3 text-[13px] leading-5 text-muted-foreground">
        I&apos;d track recall at k on a fixed golden set, re-embed on model upgrades, and alert when
        <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-foreground align-middle" />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><Mic className="size-3" /> Transcribed on device</span>
        <span>Eye contact 82%</span>
      </div>
    </div>
  );
}

function DiscussionMock() {
  const people = [
    { n: "AR", c: "bg-mod-gd/15 text-mod-gd", s: "Holding the floor", active: true },
    { n: "MK", c: "bg-mod-interview/12 text-mod-interview", s: "Queued · 1" },
    { n: "You", c: "bg-mod-practice/12 text-mod-practice", s: "Queued · 2" },
    { n: "SJ", c: "bg-mod-project/12 text-mod-project", s: "Listening" },
  ];
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-panel">
      <p className="flex items-center gap-2 text-[12px] font-medium">
        <span className="flex size-6 items-center justify-center rounded-md bg-mod-gd/12 text-mod-gd ring-1 ring-mod-gd/25">
          <Users className="size-3.5" />
        </span>
        Group discussion · &ldquo;Should AI tutors replace homework?&rdquo;
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {people.map((p) => (
          <li key={p.n} className={cn("flex items-center gap-2 rounded-xl border p-2", p.active && "border-mod-gd/50 bg-mod-gd/5")}>
            <span className={cn("flex size-8 items-center justify-center rounded-full text-[11px] font-semibold", p.c)}>{p.n}</span>
            <span className="text-[11.5px] text-muted-foreground">{p.s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportMock() {
  const bars = [
    { k: "Structure", v: 78 },
    { k: "Technical depth", v: 64 },
    { k: "Communication", v: 85 },
  ];
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-panel">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Readiness</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            74<span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </p>
        </div>
        <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">+9 this week</span>
      </div>
      <div className="mt-4 space-y-2.5">
        {bars.map((b) => (
          <div key={b.k}>
            <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
              <span>{b.k}</span>
              <span className="font-mono">{b.v}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-mod-performance" style={{ width: `${b.v}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-accent-soft p-2.5 text-[12px] leading-5">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" />
        Study next: vector index sharding, recall@k evaluation.
      </p>
    </div>
  );
}

function LandingContent() {
  return (
    <div className="landing-page min-h-dvh bg-[#061a13] text-white">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */} 
      <section className="hero-scene relative isolate flex min-h-[max(100dvh,720px)] flex-col overflow-hidden bg-[#061a13]">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          quality={85}
          className="hero-zoom -z-10 object-cover object-[50%_62%]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[#061a13]/25" />
        <header className="relative z-10 grid grid-cols-[1fr_auto] items-center gap-4 px-5 pt-5 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:px-10 lg:pt-7">
          <span className="hero-enter" style={{ animationDelay: "0ms" }}>
            <HeroBrand />
          </span>
          <nav
            aria-label="Sections"
            className="hero-enter hidden items-center gap-1 rounded-full border border-white/70 bg-(--hero-glass) p-1.5 shadow-[0_10px_30px_-12px_oklch(0.2_0.04_155/0.35)] backdrop-blur-xl lg:flex"
            style={{ animationDelay: "120ms" }}
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-1.5 text-[14px] text-(--hero-muted) transition-colors hover:bg-white/60 hover:text-(--hero-ink)"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <LoginButton className="hero-enter justify-self-end whitespace-nowrap rounded-full border border-white/70 bg-(--hero-glass) px-5 py-2 text-[14px] font-medium text-(--hero-ink) shadow-[0_10px_30px_-12px_oklch(0.2_0.04_155/0.35)] backdrop-blur-xl transition-colors hover:bg-white/90">
            Log in
          </LoginButton>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pt-[7vh] text-center sm:px-8">
          <p
            className="hero-enter whitespace-nowrap rounded-full border border-white/70 bg-white/55 px-3.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-(--hero-muted) backdrop-blur-md sm:text-[11px] sm:tracking-[0.14em]"
            style={{ animationDelay: "200ms" }}
          >
            Interviews · GDs · Practice
          </p>
          <h1 className="mt-6 text-[clamp(2.5rem,6.4vw,5.75rem)] font-medium leading-[1.02] tracking-[-0.045em] text-balance">
            <BlurText text="Bridge the gap" delayMs={300} className="block text-(--hero-ink)" />
            <span className="hero-enter mt-1 block text-[0.72em] tracking-[-0.035em]" style={{ animationDelay: "700ms" }}>
              <RotatingGap />
            </span>
          </h1>
          
          <div className="hero-enter mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "1150ms" }}>
            <LoginButton className="inline-flex h-11 items-center gap-2 rounded-full bg-(--hero-ink) px-6 text-[15px] font-medium text-white shadow-[0_12px_30px_-10px_oklch(0.2_0.04_155/0.7)] transition-colors hover:bg-(--hero-ink-strong)">
              Log in to start <ArrowRight className="size-4" />
            </LoginButton>
            <a
              href="#crossing"
              className="inline-flex h-11 items-center rounded-full border border-white/70 bg-white/60 px-6 text-[15px] font-medium text-(--hero-ink) backdrop-blur-md transition-colors hover:bg-white/90"
            >
              See how it works
            </a>
          </div>
        </div>

        <a
          href="#crossing"
          aria-label="Scroll to how it works"
          className="hero-enter relative z-10 mx-auto mb-6 flex flex-col items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/90"
          style={{ animationDelay: "1500ms" }}
        >
          Scroll
          <ArrowDown className="scroll-cue size-4" />
        </a>
      </section>

      {/* ─── The crossing: a text explanation of the product ──────────────── */} 
      <section id="crossing" className="scroll-mt-4 border-b px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-3xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.03em]">
              Every offer is on the other side of <span className="font-display italic text-accent">a crossing.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {CROSSING.map((c, i) => (
              <Reveal key={c.step} delayMs={i * 120} className="bg-[#061a13] p-7 lg:p-9">
                <p className="font-mono text-sm text-[#8ed8b0]">{c.step}</p>
                <h3 className="mt-3 text-[clamp(1.5rem,2.6vw,2.1rem)] font-medium tracking-[-0.025em]">{c.title}</h3>
                <p className="mt-4 max-w-md text-[15px] leading-7 text-white/65">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Inside the product ───────────────────────────────────────────── */}
      <section id="inside" className="scroll-mt-4 border-b border-white/10 bg-[#061a13] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Inside Blackbox</p>
              <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.03em]">
                Three rooms. <span className="font-display italic">One record.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Interview room, discussion room and your report — each with its own colour, so you always know where you are.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            <Reveal delayMs={0} className="slide-up-card"><InterviewMock /></Reveal>
            <Reveal delayMs={140} className="slide-up-card lg:mt-10"><DiscussionMock /></Reveal>
            <Reveal delayMs={280} className="slide-up-card lg:mt-20"><ReportMock /></Reveal>
          </div>
        </div>
      </section>

      {/* ─── What makes it different ──────────────────────────────────────── */}
      <section id="different" className="scroll-mt-4 border-b px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="eyebrow">Why Blackbox</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.03em]">
              Built for the whole placement loop, <span className="font-display italic">not one round.</span>
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border shadow-panel sm:grid-cols-2 lg:grid-cols-3">
            {DIFFERENT.map((d, i) => {
              const Icon = d.icon;
              return (
                <Reveal key={d.title} delayMs={(i % 3) * 110} className="bg-card p-7">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-accent/20">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-[16px] font-semibold tracking-tight">{d.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{d.body}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Tracks ───────────────────────────────────────────────────────── */}
      <section id="tracks" className="scroll-mt-4 border-b px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Target tracks</p>
              <h2 className="mt-4 max-w-2xl text-[clamp(1.9rem,3.6vw,3rem)] font-medium leading-[1.08] tracking-[-0.03em]">
                Five tracks. <span className="font-display italic">One standard.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Choose a track when you join. Your dashboard, question mix and interview rubric reorganise around it.
            </p>
          </Reveal>
          <ul className="mt-14 divide-y overflow-hidden rounded-2xl border bg-card shadow-panel">
            {TARGET_ROLES.map((role, i) => {
              const track = TRACKS[role];
              return (
                <Reveal as="li" key={role} delayMs={i * 70} className="grid gap-3 px-6 py-6 md:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.4fr)] md:items-baseline md:gap-8">
                  <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-[18px] font-medium tracking-tight">{track.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{track.summary}</p>
                  </div>
                  <ul className="flex flex-wrap gap-2" aria-label={`${track.label} competencies`}>
                    {track.competencies.map((c) => (
                      <li key={c} className="rounded-full border bg-background px-3 py-1 text-[12.5px] text-muted-foreground">
                        {c}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ─── Closing call to action over the bridge ───────────────────────── */}
      <section className="relative overflow-hidden bg-[#061a13] px-5 py-28 sm:px-8 lg:px-10">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center text-white">
          <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.035em]">
            Your next loop starts <span className="font-display italic">on this side.</span>
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-white/85">
            Sign in with Google or GitHub. We&apos;ll ask about your path, then build your first session around it.
          </p>
          <LoginButton className="glass-panel mt-8 inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-medium text-(--hero-ink) transition-transform hover:scale-[1.03]">
            Log in <ArrowRight className="size-4" />
          </LoginButton>
        </Reveal>
      </section>

      <footer className="border-t px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <Brand className="text-foreground" />
          <p>Interview and group-discussion preparation for engineers, analysts and graduates.</p>
          <nav className="flex gap-5">
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function Landing() {
  return (
    <LoginDialogProvider>
      <LandingContent />
    </LoginDialogProvider>
  );
}
