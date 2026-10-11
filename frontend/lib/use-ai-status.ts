"use client";

import { useEffect, useState } from "react";

export type AiStatusMode = "checking" | "live" | "degraded" | "offline-key" | "no-internet";

export interface AiStatusView {
  mode: AiStatusMode;
  label: string;
  detail: string;
}

const VIEWS: Record<AiStatusMode, Omit<AiStatusView, "mode">> = {
  checking: { label: "Checking AI…", detail: "Checking whether live AI is available." },
  live: {
    label: "AI live",
    detail: "Gemini is generating questions, follow-ups, feedback and voices in real time.",
  },
  degraded: {
    label: "AI reconnecting",
    detail: "Gemini isn't responding right now, so the curated question bank and rule-based scoring are being used. Live AI resumes automatically.",
  },
  "offline-key": {
    label: "Offline mode",
    detail: "No Gemini key is configured, so interviews use the curated question bank, rule-based scoring and on-device speech.",
  },
  "no-internet": {
    label: "No internet",
    detail: "You're offline. Anything already loaded keeps working; live AI resumes when you reconnect.",
  },
};

interface HealthBody {
  ai?: { mode?: "live" | "degraded" | "offline" } | string;
}

/** Live / offline status of the AI layer, refreshed on reconnects and every two minutes. */
export function useAiStatus(): AiStatusView {
  const [mode, setMode] = useState<AiStatusMode>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setMode("no-internet");
        return;
      }
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as HealthBody;
        const ai = typeof body.ai === "object" ? body.ai.mode : body.ai === "configured" ? "live" : "offline";
        if (!cancelled) setMode(ai === "live" ? "live" : ai === "degraded" ? "degraded" : "offline-key");
      } catch {
        if (!cancelled) setMode(navigator.onLine === false ? "no-internet" : "degraded");
      }
    };
    void check();
    const timer = setInterval(check, 120_000);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, []);

  return { mode, ...VIEWS[mode] };
}
