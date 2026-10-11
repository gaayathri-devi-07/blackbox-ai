"use client";

import { Activity, Database, EyeOff, FileSearch, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface FeatureMetrics {
  feature: string;
  calls: number;
  errorRate: number;
  fallbackRate: number;
  p50: number;
  p95: number;
  inputTokens: number;
  outputTokens: number;
}

interface Observability {
  days: number;
  scope: "account" | "global";
  total: FeatureMetrics | null;
  features: FeatureMetrics[];
  tracing: { enabled: boolean; project: string | null };
  reranker: string;
}

const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;
const secs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

/** P50/P95 latency, error and fallback rates, and tokens per AI feature. */
function AiHealth() {
  const { data } = useApi<Observability>("/api/observability", { days: 7 });
  if (!data?.total) return null;
  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-[13px] font-medium">
          AI health · last {data.days} days <span className="font-normal text-muted-foreground">({data.scope === "global" ? "all users" : "your account"})</span>
        </p>
        <p className="text-[12px] text-muted-foreground">
          Tracing: {data.tracing.enabled ? `LangSmith · ${data.tracing.project}` : "off"} · Reranker: {data.reranker}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[12.5px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              {["Feature", "Calls", "P50", "P95", "Errors", "Fallback", "Tokens in / out"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {[data.total, ...data.features].map((f) => (
              <tr key={f.feature} className={cn("border-t", f.feature === "all" && "bg-muted/50 font-medium")}>
                <td className="px-3 py-1.5 font-mono text-[12px]">{f.feature === "all" ? "All features" : f.feature}</td>
                <td className="px-3 py-1.5">{f.calls}</td>
                <td className="px-3 py-1.5">{secs(f.p50)}</td>
                <td className={cn("px-3 py-1.5", f.p95 > 10_000 && "text-warning")}>{secs(f.p95)}</td>
                <td className={cn("px-3 py-1.5", f.errorRate > 0.05 && "text-danger")}>{pct(f.errorRate)}</td>
                <td className={cn("px-3 py-1.5", f.fallbackRate > 0.25 && "text-warning")}>{pct(f.fallbackRate)}</td>
                <td className="px-3 py-1.5">{f.inputTokens.toLocaleString()} / {f.outputTokens.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-3 py-2 text-[11.5px] text-muted-foreground">
        Fallback means the request was answered by the offline question bank or rule-based scoring because the model failed or was unavailable.
      </p>
    </div>
  );
}

interface Governance {
  usage: {
    days: number;
    calls: number;
    live: number;
    fallback: number;
    piiMasked: number;
    guardFlagged: number;
    features: { feature: string; count: number }[];
  };
  controls: {
    piiMasking: boolean;
    auditLog: boolean;
    tracing: boolean;
    embeddings: boolean;
    knowledgeChunks: number;
    ai: "live" | "degraded" | "offline";
  };
}

function Control({ on, icon: Icon, title, detail }: { on: boolean; icon: typeof ShieldCheck; title: string; detail: string }) {
  return (
    <li className="flex gap-3 rounded-lg border bg-background p-3">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md ring-1", on ? "bg-success-soft text-success ring-success/25" : "bg-muted text-muted-foreground ring-border")}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          {title}
          <span className={cn("rounded-full px-1.5 py-px text-[10.5px] font-medium", on ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
            {on ? "On" : "Off"}
          </span>
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-5 text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}

/** How AI is used on this account: safeguards that are active and 30-day counts. */
export function PrivacyPanel() {
  const { data, loading } = useApi<Governance>("/api/governance");
  if (loading && !data) return <Skeleton className="h-48" />;
  if (!data) return <p className="text-[13px] text-muted-foreground">Privacy details are unavailable right now.</p>;
  const { usage, controls } = data;

  return (
    <div className="space-y-5">
      <ul className="grid gap-2.5 md:grid-cols-2">
        <Control
          on={controls.piiMasking}
          icon={EyeOff}
          title="Personal data masking"
          detail="Emails, phone numbers, addresses, Aadhaar, PAN, passport, voter ID, driving licence and card numbers are removed before anything is saved, and masked (with your name) before any text reaches an AI model or a trace."
        />
        <Control
          on={controls.auditLog}
          icon={Activity}
          title="AI audit log"
          detail="Every AI call is recorded with its feature, outcome and how many values were masked — never the text itself."
        />
        <Control
          on
          icon={ShieldCheck}
          title="Prompt-injection guard"
          detail="Your answers are treated as data, never as instructions to the AI, so scores can't be manipulated by text in an answer."
        />
        <Control
          on={controls.ai === "live"}
          icon={controls.ai === "live" ? Wifi : WifiOff}
          title={controls.ai === "live" ? "Live AI" : "Offline mode"}
          detail={
            controls.ai === "live"
              ? "Gemini generates questions and feedback. If it becomes unreachable, the app switches to the curated question bank automatically."
              : "Interviews use the curated question bank and rule-based scoring. Nothing you type is sent to an AI provider."
          }
        />
        <Control
          on={controls.knowledgeChunks > 0}
          icon={FileSearch}
          title="Grounded feedback (RAG)"
          detail={`Coaching and study pointers are drawn from ${controls.knowledgeChunks.toLocaleString()} curated passages${controls.embeddings ? " with semantic search" : " with keyword search"}.`}
        />
        <Control
          on
          icon={Database}
          title="On-device processing"
          detail="Camera analysis and the accurate Whisper transcript run in your browser. Video frames and recordings never leave your computer."
        />
      </ul>

      <AiHealth />

      <div className="rounded-lg border">
        <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: `AI calls (${usage.days} days)`, value: usage.calls },
            { label: "Answered offline", value: usage.fallback },
            { label: "Values masked", value: usage.piiMasked },
            { label: "Injection attempts blocked", value: usage.guardFlagged },
          ].map((s) => (
            <div key={s.label} className="p-3">
              <p className="eyebrow">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular">{s.value}</p>
            </div>
          ))}
        </div>
        {usage.features.length > 0 && (
          <p className="border-t px-3 py-2 text-[12px] text-muted-foreground">
            Most used: {usage.features.slice(0, 4).map((f) => `${f.feature} (${f.count})`).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
