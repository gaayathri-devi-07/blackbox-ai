import "server-only";

import { traceable } from "langsmith/traceable";
import { maskDeep } from "@/lib/governance/pii";
import { getAiContext } from "@/lib/ai/context";

/**
 * LangSmith tracing. Enabled with LANGSMITH_TRACING=true and LANGSMITH_API_KEY.
 * Inputs are masked before the call is made, and processInputs/processOutputs
 * mask again as defence in depth, so traces never carry personal data.
 * Nested calls (an agent's tool calls and model calls) appear as one tree.
 */
export function tracingEnabled(): boolean {
  // Both the current (LANGSMITH_*) and legacy (LANGCHAIN_TRACING_V2 / LANGCHAIN_*) names work.
  const on = process.env.LANGSMITH_TRACING === "true" || process.env.LANGCHAIN_TRACING_V2 === "true";
  return on && Boolean(process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY);
}

export function tracingProject(): string {
  return process.env.LANGSMITH_PROJECT || process.env.LANGCHAIN_PROJECT || "blackbox";
}

type RunType = "llm" | "chain" | "tool" | "retriever" | "embedding";

export async function traced<T>(
  name: string,
  runType: RunType,
  inputs: Record<string, unknown>,
  fn: () => Promise<T>,
  metadata: Record<string, unknown> = {}
): Promise<T> {
  if (!tracingEnabled()) return fn();
  const ctx = getAiContext();
  // The inputs argument only feeds the trace; the work itself is `fn`.
  const wrapped = traceable(async (traceInputs: Record<string, unknown>) => (void traceInputs, fn()), {
    name,
    run_type: runType,
    project_name: tracingProject(),
    tags: [ctx?.feature ?? "unknown", process.env.NODE_ENV ?? "development"],
    // Pseudonymous ids only — never emails or names.
    metadata: {
      ...metadata,
      feature: ctx?.feature,
      requestId: ctx?.requestId,
      user: ctx?.userId ? `u_${ctx.userId.slice(-8)}` : undefined,
    },
    processInputs: (i) => maskDeep(i as Record<string, unknown>),
    processOutputs: (o) => maskDeep(o as Record<string, unknown>),
  });
  return wrapped(inputs) as Promise<T>;
}
