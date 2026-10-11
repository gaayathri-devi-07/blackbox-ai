import "server-only";

import type { z } from "zod";
import { circuitOpen, recordAiFailure, recordAiSuccess } from "@/lib/ai/availability";
import { getAiContext } from "@/lib/ai/context";
import { recordAiEvent } from "@/lib/governance/audit";
import { scanForInjection, withGuardrails } from "@/lib/governance/guard";
import { createVault, maskPii, unmaskPii, vaultSummary, type PiiVault } from "@/lib/governance/pii";
import { traced } from "@/lib/observability/tracing";

/**
 * Gemini REST client with governance built in.
 *
 * Every call goes through the same pipeline:
 *   1. PII masking   — emails, phones, IDs, keys and the candidate's name become
 *                      placeholders; the reply is restored afterwards.
 *   2. Guardrails    — a data-not-instructions preamble on every system prompt;
 *                      injection attempts in user text are flagged.
 *   3. Circuit breaker — when Gemini keeps failing the app switches to offline
 *                      content immediately instead of waiting on timeouts.
 *   4. Tracing       — LangSmith (when enabled) receives only masked payloads.
 *   5. Audit log     — one row per call with sizes, outcome and mask counts.
 *
 * The API key travels in a header, never in the URL. Models are tried in
 * GEMINI_MODELS order; a 404 (retired model) falls through to the next one.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/**
 * Measured on 10 Oct 2026 with a short JSON prompt: 3.5-flash ≈ 2.9 s,
 * 3.5-flash-lite ≈ 1.4 s; 3.8-flash was overloaded (503) and 2.5 models are
 * retired for new keys. Conversation needs answers in seconds, so the fast
 * models come first and the larger one is a fallback.
 */
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
/** For latency-critical work (transcription, short turns): lite first. */
const FAST_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

export class AIUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export interface GenerateOptions {
  system?: string;
  /** Either a single prompt or a multi-turn conversation. */
  prompt?: string;
  turns?: ChatTurn[];
  /** Binary input sent alongside the prompt, e.g. recorded audio for transcription. */
  inlineData?: { mimeType: string; data: string };
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  json?: boolean;
  signal?: AbortSignal;
  /** Overrides the feature label from the request context (audit + traces). */
  feature?: string;
  /** Prefer the lowest-latency models (live conversation, transcription). */
  fast?: boolean;
}

let preferredModel: string | null = null;
let thinkingConfigRejected = false;

/** Models that recently answered 503/429/timeout are skipped for a minute. */
const coolingUntil = new Map<string, number>();
const COOL_MS = 60_000;

function modelList(fast = false): string[] {
  const configured = (process.env.GEMINI_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const base = configured.length ? configured : fast ? FAST_MODELS : DEFAULT_MODELS;
  const ordered = preferredModel && !fast && base.includes(preferredModel) ? [preferredModel, ...base.filter((m) => m !== preferredModel)] : base;
  const now = Date.now();
  const available = ordered.filter((m) => (coolingUntil.get(m) ?? 0) < now);
  // If everything is cooling, try them anyway rather than failing outright.
  return available.length ? available : ordered;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** A key is set and the circuit breaker is closed: worth trying a live call. */
export function aiReachable(): boolean {
  return aiConfigured() && !circuitOpen();
}

export function piiMaskingEnabled(): boolean {
  return process.env.PII_MASKING !== "off";
}

/** Keep latency low for conversational turns; reasoning depth isn't needed here. */
function thinkingConfigFor(model: string): Record<string, unknown> | undefined {
  if (thinkingConfigRejected) return undefined;
  if (model.startsWith("gemini-2.5-flash")) return { thinkingBudget: 0 };
  if (/^gemini-3/.test(model)) return { thinkingLevel: "low" };
  return undefined;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// ─── Low-level request ────────────────────────────────────────────────────────

/** Gemini content part (text, inline data, or function calling). Passed through verbatim. */
export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface RawRequest {
  contents: GeminiContent[];
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  tools?: FunctionDeclaration[];
  /** Total time budget across all models. */
  timeoutMs?: number;
  signal?: AbortSignal;
  fast?: boolean;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface RawResponse {
  model: string;
  content: GeminiContent;
  finishReason?: string;
  usage?: TokenUsage;
}

async function callModel(model: string, req: RawRequest, apiKey: string): Promise<RawResponse> {
  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.7,
    maxOutputTokens: req.maxOutputTokens ?? 1024,
  };
  if (req.json) generationConfig.responseMimeType = "application/json";
  const thinking = thinkingConfigFor(model);
  if (thinking) generationConfig.thinkingConfig = thinking;

  const body: Record<string, unknown> = { contents: req.contents, generationConfig };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };
  if (req.tools?.length) {
    body.tools = [{ functionDeclarations: req.tools }];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const timeout = AbortSignal.timeout(Math.max(1, Math.round(req.timeoutMs ?? 20_000)));
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;

  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpError(res.status, detail.slice(0, 300));
  }

  const data = (await res.json()) as {
    candidates?: { content?: { role?: string; parts?: GeminiPart[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number };
  };
  const u = data.usageMetadata;
  const usage: TokenUsage | undefined = u
    ? {
        input_tokens: u.promptTokenCount ?? 0,
        output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
        total_tokens: u.totalTokenCount ?? (u.promptTokenCount ?? 0) + (u.candidatesTokenCount ?? 0),
      }
    : undefined;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  if (!parts.length) {
    const reason = data.promptFeedback?.blockReason ?? candidate?.finishReason ?? "EMPTY";
    throw new AIUnavailableError(`Model returned no content (${reason}).`);
  }
  return { model, content: { role: "model", parts }, finishReason: candidate?.finishReason, usage };
}

/**
 * Model fallback and the circuit breaker around one request. An overloaded
 * (503), rate-limited (429) or slow model is skipped straight away and the next
 * one tried, all within one time budget, so a busy model never stalls the
 * conversation.
 */
async function request(req: RawRequest): Promise<RawResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIUnavailableError("GEMINI_API_KEY is not configured.");
  if (circuitOpen()) throw new AIUnavailableError("Gemini is temporarily unreachable; using offline content.");

  const deadline = Date.now() + (req.timeoutMs ?? 20_000);
  const models = modelList(req.fast);
  let lastError: unknown;
  let connectivityFailures = 0;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    // Leave time for at least one more model after this attempt.
    // AbortSignal.timeout only accepts whole milliseconds.
    const attemptMs = Math.round(i < models.length - 1 ? Math.min(remaining, Math.max(6000, remaining * 0.6)) : remaining);
    const attemptStarted = Date.now();
    const devLog = (why: string) => {
      if (process.env.NODE_ENV !== "production") console.warn(`[gemini] ${model} ${why} after ${Date.now() - attemptStarted} ms — trying the next model`);
    };
    try {
      const res = await callModel(model, { ...req, timeoutMs: attemptMs }, apiKey);
      if (!req.fast) preferredModel = model;
      recordAiSuccess();
      return res;
    } catch (error) {
      lastError = error;
      if (req.signal?.aborted) throw new AIUnavailableError("Request cancelled.", error);
      if (error instanceof HttpError) {
        if (error.status === 404) continue; // retired / unknown model → next model
        if (error.status === 400 && /thinking/i.test(error.message) && !thinkingConfigRejected) {
          thinkingConfigRejected = true; // retry this model without thinking config
          i--;
          continue;
        }
        if (error.status === 429 || error.status >= 500) {
          devLog(`HTTP ${error.status}`);
          coolingUntil.set(model, Date.now() + COOL_MS);
          connectivityFailures++;
          continue;
        }
        if (error.status === 401 || error.status === 403) recordAiFailure();
        throw new AIUnavailableError(`Gemini request failed (${error.status}).`, error);
      }
      if (error instanceof AIUnavailableError) throw error;
      // Timeout or network failure on this model: cool it and try the next.
      devLog((error as Error).name === "TimeoutError" ? "timed out" : `failed (${(error as Error).message})`);
      coolingUntil.set(model, Date.now() + COOL_MS);
      connectivityFailures++;
    }
  }
  if (connectivityFailures) recordAiFailure();
  throw new AIUnavailableError("No Gemini model answered in time.", lastError);
}

function textOf(content: GeminiContent): string {
  return content.parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
    .trim();
}

// ─── Governed text generation ─────────────────────────────────────────────────

interface Masker {
  vault: PiiVault;
  mask: (text: string | undefined) => string | undefined;
}

export function createMasker(vault: PiiVault = createVault()): Masker {
  const names = getAiContext()?.names ?? [];
  const enabled = piiMaskingEnabled();
  return {
    vault,
    mask: (text) => (text && enabled ? maskPii(text, { vault, names }).text : text),
  };
}

/** Generate text. Throws AIUnavailableError when the model can't be reached. */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const started = Date.now();
  const { vault, mask } = createMasker();
  const userText = [opts.prompt, ...(opts.turns ?? []).filter((t) => t.role === "user").map((t) => t.text)].join("\n");
  const guardFlags = scanForInjection(userText);

  const system = withGuardrails(mask(opts.system));
  const contents: GeminiContent[] = opts.turns?.length
    ? opts.turns.map((t) => ({ role: t.role, parts: [{ text: mask(t.text) ?? "" }] }))
    : [{ role: "user", parts: [...(opts.inlineData ? [{ inlineData: opts.inlineData }] : []), { text: mask(opts.prompt) ?? "" }] }];
  const promptChars = (system?.length ?? 0) + contents.reduce((n, c) => n + c.parts.reduce((m, p) => m + (p.text?.length ?? 0), 0), 0);
  const operation = opts.inlineData ? "transcribe" : opts.json ? "json" : "generate";

  try {
    const res = await traced(
      `gemini.${operation}`,
      "llm",
      { system, messages: contents.map((c) => ({ role: c.role, text: c.parts.map((p) => p.text ?? "[binary]").join("") })) },
      async () => {
        const r = await request({
          contents,
          system,
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
          json: opts.json,
          timeoutMs: opts.timeoutMs,
          signal: opts.signal,
          fast: opts.fast,
        });
        const text = textOf(r.content);
        if (!text) throw new AIUnavailableError(`Model returned no text (${r.finishReason ?? "EMPTY"}).`);
        // usage_metadata is the field LangSmith reads for token counts and cost.
        return { text, model: r.model, usage_metadata: r.usage };
      },
      { ls_provider: "google", ls_model_name: modelList(opts.fast)[0], temperature: opts.temperature }
    );
    recordAiEvent({
      operation,
      outcome: "OK",
      model: res.model,
      feature: opts.feature,
      latencyMs: Date.now() - started,
      promptChars,
      outputChars: res.text.length,
      inputTokens: res.usage_metadata?.input_tokens,
      outputTokens: res.usage_metadata?.output_tokens,
      piiMasked: vaultSummary(vault),
      guardFlags,
    });
    return unmaskPii(res.text, vault);
  } catch (error) {
    recordAiEvent({
      operation,
      outcome: error instanceof AIUnavailableError ? "FALLBACK" : "ERROR",
      feature: opts.feature,
      latencyMs: Date.now() - started,
      promptChars,
      piiMasked: vaultSummary(vault),
      guardFlags,
      detail: (error as Error).message,
    });
    throw error;
  }
}

/** Generate JSON and validate it against a schema. */
export async function generateJson<S extends z.ZodType>(schema: S, opts: GenerateOptions): Promise<z.infer<S>> {
  const raw = await generateText({ ...opts, json: true });
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new AIUnavailableError("Model returned malformed JSON.", error);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new AIUnavailableError("Model JSON did not match the expected shape.", result.error);
  return result.data;
}

/**
 * One step of a tool-using conversation (used by the agent runtime). The caller
 * owns masking of the contents; the model's parts are returned verbatim so
 * thought signatures survive the next turn.
 */
export async function generateWithTools(req: {
  system: string;
  contents: GeminiContent[];
  tools: FunctionDeclaration[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: GeminiContent; text: string; calls: { name: string; args: Record<string, unknown> }[]; model: string }> {
  const r = await request({ ...req, system: withGuardrails(req.system) });
  const calls = r.content.parts
    .filter((p) => p.functionCall?.name)
    .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
  return { content: r.content, text: textOf(r.content), calls, model: r.model };
}

/** Remove markdown emphasis and stray quoting from spoken lines. */
export function toSpokenText(text: string, maxChars = 600): string {
  return text
    .replace(/[*_#`>]/g, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

// ─── Speech synthesis ─────────────────────────────────────────────────────────

/** Measured: 3.8-flash-lite-tts streams first audio in ≈1.1 s; 2.5-preview-tts was rate limited. */
const DEFAULT_TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

function ttsModels(): string[] {
  const configured = (process.env.GEMINI_TTS_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  const base = configured.length ? configured : DEFAULT_TTS_MODELS;
  const ordered = preferredTtsModel ? [preferredTtsModel, ...base.filter((m) => m !== preferredTtsModel)] : base;
  const now = Date.now();
  const available = ordered.filter((m) => (coolingUntil.get(m) ?? 0) < now);
  return available.length ? available : ordered;
}

/**
 * Stream expressive speech as raw 16-bit PCM chunks (24 kHz mono) as soon as
 * Gemini produces them, so playback starts about a second after the request
 * instead of after the whole line is synthesised.
 */
export async function streamSpeech(
  text: string,
  voice: string,
  direction: string | undefined,
  signal: AbortSignal
): Promise<{ sampleRate: number; chunks: AsyncGenerator<Buffer> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIUnavailableError("GEMINI_API_KEY is not configured.");
  if (circuitOpen()) throw new AIUnavailableError("Gemini is temporarily unreachable.");
  const spoken = piiMaskingEnabled() ? maskPii(text, { skip: ["NAME"] }).text : text;
  const prompt = direction ? `${direction}\n\n${spoken}` : spoken;
  const started = Date.now();

  let lastError: unknown;
  for (const model of ttsModels()) {
    // Give up on a model that hasn't started answering within 6 s; once audio
    // starts flowing, the stream runs as long as it needs.
    const firstByte = new AbortController();
    const firstByteTimer = setTimeout(() => firstByte.abort(), 6000);
    const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.any([signal, firstByte.signal]),
      cache: "no-store",
    })
      .catch((error: unknown) => {
        lastError = error;
        return null;
      })
      .finally(() => clearTimeout(firstByteTimer));
    if (!res) {
      if (signal.aborted) throw new AIUnavailableError("Speech cancelled.");
      coolingUntil.set(model, Date.now() + COOL_MS);
      continue;
    }
    if (!res.ok || !res.body) {
      lastError = new HttpError(res.status, model);
      if (res.status === 429 || res.status >= 500) coolingUntil.set(model, Date.now() + COOL_MS);
      recordAiEvent({ operation: "tts", outcome: "FALLBACK", model, latencyMs: Date.now() - started, detail: `HTTP ${res.status}` });
      continue;
    }
    preferredTtsModel = model;
    recordAiSuccess();
    const reader = res.body.getReader();
    let sampleRate = 24_000;

    async function* chunks(): AsyncGenerator<Buffer> {
      const decoder = new TextDecoder();
      let buffered = "";
      let bytes = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffered.indexOf("\n")) >= 0) {
            const line = buffered.slice(0, nl).trim();
            buffered = buffered.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const data = JSON.parse(line.slice(5)) as {
                candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
              };
              for (const part of data.candidates?.[0]?.content?.parts ?? []) {
                if (!part.inlineData?.data) continue;
                const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? "")?.[1] ?? 0);
                if (rate) sampleRate = rate;
                const pcm = Buffer.from(part.inlineData.data, "base64");
                bytes += pcm.length;
                yield pcm;
              }
            } catch {
              /* keep-alive or partial line */
            }
          }
        }
      } finally {
        recordAiEvent({ operation: "tts", outcome: "OK", model, latencyMs: Date.now() - started, promptChars: prompt.length, outputChars: bytes });
      }
    }
    return { sampleRate, chunks: chunks() };
  }
  throw new AIUnavailableError("No Gemini TTS model is available.", lastError);
}

/** Prebuilt Gemini voices used by the app (each has a distinct timbre). */
export const GEMINI_VOICES = ["Charon", "Kore", "Puck", "Aoede", "Fenrir", "Leda", "Orus", "Zephyr", "Iapetus", "Sulafat"] as const;

let preferredTtsModel: string | null = null;

/**
 * Synthesize expressive speech with Gemini's TTS models. `direction` is a
 * natural-language performance note (emotion, pace, pauses) that the model
 * follows; see lib/voice/prosody.ts. Returns 16-bit PCM wrapped as WAV (base64).
 */
export async function synthesizeSpeech(text: string, voice: string, direction?: string): Promise<{ audio: string; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIUnavailableError("GEMINI_API_KEY is not configured.");
  if (circuitOpen()) throw new AIUnavailableError("Gemini is temporarily unreachable.");
  const models = ttsModels();
  // Names are spoken, so only high-risk identifiers are masked here.
  const spoken = piiMaskingEnabled() ? maskPii(text, { skip: ["NAME"] }).text : text;
  const prompt = direction ? `${direction}\n\n${spoken}` : spoken;
  const started = Date.now();

  let lastError: unknown;
  for (const model of models) {
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (res.status === 404) {
        lastError = new HttpError(404, model);
        continue;
      }
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) recordAiFailure();
        throw new AIUnavailableError(`Gemini TTS failed (${res.status}).`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
      };
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
      if (!part?.data) throw new AIUnavailableError("Gemini TTS returned no audio.");
      preferredTtsModel = model;
      recordAiSuccess();
      recordAiEvent({ operation: "tts", outcome: "OK", model, latencyMs: Date.now() - started, promptChars: prompt.length });
      const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24_000);
      return { audio: pcmToWavBase64(part.data, rate), mimeType: "audio/wav" };
    } catch (error) {
      recordAiEvent({ operation: "tts", outcome: "FALLBACK", model, latencyMs: Date.now() - started, detail: (error as Error).message });
      if (error instanceof AIUnavailableError) throw error;
      recordAiFailure();
      throw new AIUnavailableError("Gemini TTS timed out or could not connect.", error);
    }
  }
  throw new AIUnavailableError("No Gemini TTS model is available.", lastError);
}

function pcmToWavBase64(pcmBase64: string, sampleRate: number): string {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

// ─── Transcription ────────────────────────────────────────────────────────────

/** Accurate transcript of a recorded spoken answer (16 kHz WAV, base64). */
export async function transcribeAudio(wavBase64: string, opts: { accent?: string; context?: string } = {}): Promise<string> {
  const text = await generateText({
    system:
      "You are a precise speech-to-text engine for technical job interviews. Transcribe exactly what the speaker says in English; speakers often have Indian or other non-US accents. Keep technical terms, acronyms and numbers accurate, and when a sound matches a technical term, use its standard spelling (for example int8, ONNX, PyTorch, TensorFlow, FastAPI, Kafka, Redis, Kubernetes, LLM, RAG, BERT, k-NN, p99, SQL, NoSQL, API). Remove only long silences and repeated filler; do not add commentary, labels or quotation marks.",
    prompt: `Transcribe this spoken interview answer.${opts.accent ? ` The speaker's accent is ${opts.accent}.` : ""}${
      opts.context ? ` It answers the question: "${opts.context}". Use this only to spell technical terms correctly.` : ""
    } If nothing intelligible is said, return an empty string.`,
    inlineData: { mimeType: "audio/wav", data: wavBase64 },
    temperature: 0,
    maxOutputTokens: 2048,
    timeoutMs: 12_000,
    feature: "transcribe",
    fast: true,
  });
  return text.replace(/^["']|["']$/g, "").trim();
}
