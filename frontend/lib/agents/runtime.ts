import "server-only";

import type { z } from "zod";
import { AIUnavailableError, createMasker, generateWithTools, type FunctionDeclaration, type GeminiContent } from "@/lib/ai/gemini";
import { recordAiEvent } from "@/lib/governance/audit";
import { maskDeep, unmaskPii, vaultSummary, type PiiVault } from "@/lib/governance/pii";
import { traced } from "@/lib/observability/tracing";

/**
 * A small, governed agent runtime on Gemini function calling.
 *
 *  - Tools are declared with a JSON schema for the model and a zod schema that
 *    validates every argument before the tool runs.
 *  - Tools are read-only by design; anything with side effects is done by the
 *    caller after validating the agent's final answer.
 *  - A step budget bounds cost and latency; every model step and tool call is
 *    audited and traced (masked).
 *  - Tool results are masked before they go back to the model, and placeholders
 *    in tool arguments are restored before the tool runs.
 */

export interface AgentTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  /** JSON schema shown to the model. */
  parameters: Record<string, unknown>;
  /** Validates arguments before execution. */
  args: S;
  run: (args: z.infer<S>) => Promise<unknown>;
  /** One line for the transparency trace shown to the candidate. */
  summarize?: (args: z.infer<S>, result: unknown) => string;
}

export interface AgentStep {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  ms: number;
  ok: boolean;
}

export interface AgentResult {
  text: string;
  steps: AgentStep[];
  model: string | null;
}

// Tools are heterogeneous; callers declare each with its own schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tool<S extends z.ZodType>(t: AgentTool<S>): AgentTool<any> {
  return t;
}

function unmaskArgs(value: unknown, vault: PiiVault): unknown {
  if (typeof value === "string") return unmaskPii(value, vault);
  if (Array.isArray(value)) return value.map((v) => unmaskArgs(v, vault));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unmaskArgs(v, vault)]));
  return value;
}

export async function runAgent(opts: {
  name: string;
  system: string;
  goal: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: AgentTool<any>[];
  maxSteps?: number;
  temperature?: number;
}): Promise<AgentResult> {
  const maxSteps = opts.maxSteps ?? 6;
  const { vault, mask } = createMasker();
  const declarations: FunctionDeclaration[] = opts.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
  const byName = new Map(opts.tools.map((t) => [t.name, t]));
  const contents: GeminiContent[] = [{ role: "user", parts: [{ text: mask(opts.goal) ?? "" }] }];
  const steps: AgentStep[] = [];
  let model: string | null = null;

  return traced(`agent.${opts.name}`, "chain", { goal: opts.goal }, async () => {
    for (let step = 0; step < maxSteps; step++) {
      const started = Date.now();
      let res: Awaited<ReturnType<typeof generateWithTools>>;
      try {
        res = await generateWithTools({
          system: mask(opts.system) ?? "",
          contents,
          // On the last step, withhold tools so the model must answer.
          tools: step === maxSteps - 1 ? [] : declarations,
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: 2000,
          timeoutMs: 25_000,
        });
      } catch (error) {
        recordAiEvent({ operation: "agent", outcome: "FALLBACK", feature: `agent.${opts.name}`, latencyMs: Date.now() - started, detail: (error as Error).message });
        throw error instanceof AIUnavailableError ? error : new AIUnavailableError("Agent step failed.", error);
      }
      model = res.model;
      recordAiEvent({
        operation: "agent",
        outcome: "OK",
        model: res.model,
        feature: `agent.${opts.name}`,
        latencyMs: Date.now() - started,
        outputChars: res.text.length,
        piiMasked: vaultSummary(vault),
        detail: res.calls.length ? `calls: ${res.calls.map((c) => c.name).join(", ")}` : "final answer",
      });
      contents.push(res.content);

      if (!res.calls.length) {
        return { text: unmaskPii(res.text, vault), steps, model };
      }

      const responses: GeminiContent = { role: "user", parts: [] };
      for (const call of res.calls) {
        const t = byName.get(call.name);
        const toolStarted = Date.now();
        let payload: Record<string, unknown>;
        if (!t) {
          payload = { error: `Unknown tool "${call.name}".` };
          steps.push({ tool: call.name, args: call.args, summary: "Unknown tool", ms: 0, ok: false });
        } else {
          const parsed = t.args.safeParse(unmaskArgs(call.args, vault));
          if (!parsed.success) {
            payload = { error: `Invalid arguments: ${parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.map(String).join(".")} ${i.message}`).join("; ")}` };
            steps.push({ tool: t.name, args: call.args, summary: "Rejected invalid arguments", ms: 0, ok: false });
          } else {
            try {
              const result = await traced(`tool.${t.name}`, "tool", parsed.data as Record<string, unknown>, () => t.run(parsed.data));
              payload = { result: maskDeep(result, { vault }) as unknown };
              steps.push({
                tool: t.name,
                args: parsed.data as Record<string, unknown>,
                summary: t.summarize?.(parsed.data, result) ?? "Done",
                ms: Date.now() - toolStarted,
                ok: true,
              });
              recordAiEvent({ operation: "tool", outcome: "OK", feature: `agent.${opts.name}.${t.name}`, latencyMs: Date.now() - toolStarted });
            } catch (error) {
              payload = { error: "The tool failed. Continue without it." };
              steps.push({ tool: t.name, args: parsed.data as Record<string, unknown>, summary: "Tool failed", ms: Date.now() - toolStarted, ok: false });
              recordAiEvent({ operation: "tool", outcome: "ERROR", feature: `agent.${opts.name}.${t.name}`, latencyMs: Date.now() - toolStarted, detail: (error as Error).message });
            }
          }
        }
        responses.parts.push({ functionResponse: { name: call.name, response: payload } });
      }
      contents.push(responses);
    }
    throw new AIUnavailableError("Agent did not finish within its step budget.");
  });
}

/** Parse the agent's final JSON answer; tolerant of code fences. */
export function parseFinalJson<S extends z.ZodType>(schema: S, text: string): z.infer<S> | null {
  const cleaned = text.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/, "").trim();
  const candidates = [cleaned, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    try {
      const r = schema.safeParse(JSON.parse(c));
      if (r.success) return r.data;
    } catch {
      /* try next */
    }
  }
  return null;
}
