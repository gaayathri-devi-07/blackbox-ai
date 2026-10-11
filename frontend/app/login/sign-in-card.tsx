"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ConfirmationResult } from "firebase/auth";
import { ArrowLeft, ArrowRight, Phone } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { authErrorMessage, firebaseConfigured, sendPhoneCode, signInWithGithub, signInWithGoogle } from "@/lib/firebase";

/*
 * The card sits on a fixed daylight photograph, so it uses the hero's own ink
 * and glass tokens (see .hero-scene in globals.css) instead of the app theme.
 */
const providerButton =
  "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-full border border-(--hero-line) bg-white/70 text-sm font-medium text-(--hero-ink) transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hero-ink)";
const primaryButton =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-(--hero-ink) text-sm font-medium text-white shadow-[0_1px_0_oklch(1_0_0/0.15)_inset,0_8px_20px_-8px_oklch(0.2_0.04_155/0.6)] transition-colors hover:bg-(--hero-ink-strong) disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hero-ink)";
const field =
  "h-10 w-full rounded-xl border border-(--hero-line) bg-white/80 px-3.5 text-sm text-(--hero-ink) outline-none placeholder:text-(--hero-muted) focus:border-(--hero-ink) focus:ring-2 focus:ring-(--hero-ink)/15";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.95l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export function SignInCard({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { status, profile, demoAvailable, signInDemo } = useAuth();
  const [pending, setPending] = useState<null | "google" | "github" | "phone" | "code">(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"providers" | "phone">("providers");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const configured = firebaseConfigured();

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";

  useEffect(() => {
    if (status !== "signed-in" || !profile) return;
    router.replace(profile.onboardingComplete ? safeNext : "/onboarding");
  }, [status, profile, router, safeNext]);

  async function run(kind: "google" | "github", fn: () => Promise<void>) {
    setError(null);
    setPending(kind);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
      setPending(null);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("phone");
    try {
      setConfirmation(await sendPhoneCode(phone.trim(), "recaptcha-anchor"));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmation) return;
    setError(null);
    setPending("code");
    try {
      await confirmation.confirm(code.trim());
    } catch (err) {
      setError(authErrorMessage(err));
      setPending(null);
    }
  }

  const busy = pending !== null || status === "loading" || (status === "signed-in" && !profile);
  const spinner = <Spinner className="text-current" />;

  return (
    <div
      className={cn(
        "glass-panel rounded-[28px] p-6 text-(--hero-ink) sm:p-8",
        className,
      )}
    >
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--hero-muted)">Member access</p>
      <h2 id="sign-in-title" className="mt-1.5 text-[22px] font-medium leading-tight tracking-tight">
        Sign in to <span className="font-display text-[25px] italic">Blackbox</span>
      </h2>
      <p className="mt-1.5 text-[13px] leading-5 text-(--hero-muted)">
        New here? Signing in creates your account, then we&apos;ll ask a few questions about your career path.
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-700/20 bg-red-50/90 px-3 py-2.5 text-[13px] leading-5 text-red-800">
          {error}
        </div>
      )}

      {!configured && !demoAvailable && (
        <div className="mt-4 rounded-xl border border-(--hero-line) bg-white/60 px-3 py-2.5 text-[13px] leading-5 text-(--hero-muted)">
          Authentication isn&apos;t configured. Add the <span className="font-mono text-(--hero-ink)">NEXT_PUBLIC_FIREBASE_*</span> values to{" "}
          <span className="font-mono text-(--hero-ink)">.env.local</span> and restart the server.
        </div>
      )}

      {mode === "providers" ? (
        <div className="mt-5 space-y-2">
          <button type="button" className={providerButton} disabled={!configured || busy} onClick={() => run("google", signInWithGoogle)}>
            {pending === "google" ? spinner : <GoogleIcon />}
            Continue with Google
          </button>
          <button type="button" className={providerButton} disabled={!configured || busy} onClick={() => run("github", signInWithGithub)}>
            {pending === "github" ? spinner : <GithubIcon />}
            Continue with GitHub
          </button>
          <button
            type="button"
            className={cn(providerButton, "border-transparent bg-transparent hover:bg-white/50")}
            disabled={!configured || busy}
            onClick={() => {
              setError(null);
              setMode("phone");
            }}
          >
            <Phone className="size-4" />
            Continue with phone number
          </button>

          {demoAvailable && (
            <>
              <div className="flex items-center gap-3 py-1" aria-hidden>
                <div className="h-px flex-1 bg-(--hero-line)" />
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--hero-muted)">Local development</span>
                <div className="h-px flex-1 bg-(--hero-line)" />
              </div>
              <button type="button" className={primaryButton} disabled={busy} onClick={signInDemo}>
                Enter with demo account
                <ArrowRight className="size-4" />
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-5">
          {!confirmation ? (
            <form onSubmit={sendCode} className="space-y-3">
              <label htmlFor="phone" className="block text-[13px] font-medium">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 415 555 0123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
                required
              />
              <button type="submit" className={primaryButton} disabled={busy || phone.trim().length < 8}>
                {pending === "phone" && spinner}
                Send verification code
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-3">
              <label htmlFor="code" className="block text-[13px] font-medium">
                Enter the 6-digit code sent to {phone}
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={cn(field, "h-11 text-center font-mono text-lg tracking-[0.4em]")}
                required
              />
              <button type="submit" className={primaryButton} disabled={busy || code.length !== 6}>
                {pending === "code" && spinner}
                Verify and continue
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setMode("providers");
              setConfirmation(null);
              setCode("");
              setError(null);
            }}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-(--hero-muted) hover:text-(--hero-ink)"
          >
            <ArrowLeft className="size-3.5" />
            Other sign-in options
          </button>
          <div id="recaptcha-anchor" />
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-[1.1rem] text-(--hero-muted)">
        By continuing you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-(--hero-ink)">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-(--hero-ink)">
          Privacy Policy
        </Link>
        . Transcripts are used only to generate your feedback.
      </p>
    </div>
  );
}
