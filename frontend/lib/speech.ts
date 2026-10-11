"use client";

/**
 * Browser speech: natural-sounding text-to-speech and live dictation.
 *
 * Speaking: the best installed voice is chosen by quality (neural "Natural" /
 * "Online" voices first, then Google voices, then legacy desktop voices), and
 * text is delivered phrase by phrase with emotion-aware pitch, pace and pauses
 * (see lib/voice/prosody.ts) instead of one flat utterance. When the server has
 * a Gemini key, `speak` uses expressive AI voices directed by the same emotion.
 *
 * Listening: recognition uses the candidate's own English accent (en-IN,
 * en-GB, …) which markedly improves accuracy, streams interim words as they
 * are heard, and restarts immediately when the browser ends a session.
 */

import { api, apiStream } from "@/lib/api-client";
import { playPcmStream } from "@/lib/voice/stream-player";
import { inferEmotion, performanceNote, phrasePlan, withNaturalPauses, type DeliveryHint, type Emotion } from "@/lib/voice/prosody";

// ─── Voices ───────────────────────────────────────────────────────────────────

const FEMALE_HINTS = ["female", "woman", "zira", "hazel", "susan", "samantha", "victoria", "karen", "moira", "fiona", "tessa", "aria", "jenny", "emma", "sonia", "libby", "natasha", "heera", "neerja", "veena", "ava", "michelle", "ana", "clara", "google uk english female", "google us english"];
const MALE_HINTS = ["male", "man", "david", "mark", "daniel", "james", "george", "ryan", "guy", "thomas", "alex", "fred", "oliver", "ravi", "rishi", "prabhat", "andrew", "brian", "christopher", "eric", "roger", "steffan", "william", "google uk english male"];

export function guessVoiceGender(name: string): "male" | "female" | "unknown" {
  const n = name.toLowerCase();
  if (MALE_HINTS.some((h) => n.includes(h)) && !n.includes("female")) return "male";
  if (FEMALE_HINTS.some((h) => n.includes(h))) return "female";
  return "unknown";
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Voices load asynchronously in Chromium; wait briefly for them. */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!speechSynthesisSupported()) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, timeoutMs);
  });
}

/**
 * How human a voice sounds, higher is better. Neural voices (Edge's
 * "… Online (Natural)", macOS premium voices) are far more natural than the
 * legacy desktop voices Windows ships (David, Zira, Mark).
 */
export function voiceQuality(voice: SpeechSynthesisVoice, accent = getSpeechLang()): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/natural|neural|online|premium|enhanced/.test(name)) score += 60;
  if (name.startsWith("google")) score += 35;
  if (/\b(david|zira|mark|hazel|george|susan)\b/.test(name) && name.includes("microsoft") && !/online|natural/.test(name)) score -= 25;
  const lang = voice.lang.toLowerCase();
  if (lang === accent.toLowerCase()) score += 12;
  else if (lang === "en-us" || lang === "en-gb") score += 6;
  if (!voice.localService) score += 2; // cloud voices are usually the neural ones
  return score;
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredName: string | null | undefined,
  gender: "male" | "female",
  opts: { exclude?: string[] } = {}
): SpeechSynthesisVoice | null {
  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }
  const exclude = new Set(opts.exclude ?? []);
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const ranked = [...english].sort((a, b) => voiceQuality(b) - voiceQuality(a));
  return (
    ranked.find((v) => guessVoiceGender(v.name) === gender && !exclude.has(v.name)) ??
    ranked.find((v) => guessVoiceGender(v.name) === gender) ??
    ranked.find((v) => !exclude.has(v.name)) ??
    ranked[0] ??
    voices[0] ??
    null
  );
}

/** English voices sorted best-first, for voice pickers. */
export function rankedEnglishVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().startsWith("en")).sort((a, b) => voiceQuality(b) - voiceQuality(a));
}

// ─── Natural delivery ─────────────────────────────────────────────────────────

/** Split into sentence-sized chunks; very long sentences break at a comma. */
export function toPhrases(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [];
  const out: string[] = [];
  for (const s of sentences) {
    if (s.length <= 220) {
      out.push(s);
      continue;
    }
    // Chrome truncates very long utterances; split at the comma nearest the middle.
    const mid = s.lastIndexOf(",", Math.floor(s.length / 2) + 40);
    if (mid > 40) out.push(s.slice(0, mid + 1).trim(), s.slice(mid + 1).trim());
    else out.push(s);
  }
  return out;
}

interface SpeakOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  /** Abort to stop speaking immediately (resolves the promise). */
  signal?: AbortSignal;
  /** When TTS is muted, wait a reading-time estimate instead of speaking. */
  muted?: boolean;
  /** Gemini voice name; used when the server offers AI voices. */
  serverVoice?: string;
  /** Personality of the speaker, e.g. "data-driven and direct" (folded into the delivery note). */
  style?: string;
  /** What the line does in the conversation; drives emotion, pauses and pitch. */
  hint?: DeliveryHint;
  /** Force an emotion instead of inferring it from the text and hint. */
  emotion?: Emotion;
  /** Called as each phrase starts — drives captions. */
  onPhrase?: (phrase: string, index: number) => void;
  /** True exactly while sound is coming out — drives the avatar's mouth. */
  onSpeakingChange?: (speaking: boolean) => void;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

function speakPhrase(text: string, opts: SpeakOptions, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (opts.signal?.aborted) return resolve();
    let settled = false;
    const words = text.split(/\s+/).length;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safety);
      resolve();
    };
    const utterance = new SpeechSynthesisUtterance(text);
    if (opts.voice) {
      utterance.voice = opts.voice;
      utterance.lang = opts.voice.lang;
    }
    utterance.rate = rate;
    utterance.pitch = opts.pitch ?? 1;
    utterance.onstart = () => opts.onSpeakingChange?.(true);
    utterance.onend = () => (opts.onSpeakingChange?.(false), finish());
    utterance.onerror = () => (opts.onSpeakingChange?.(false), finish());
    // Some browsers never fire onend; never hang the conversation.
    const safety = setTimeout(finish, 3000 + words * 650);
    window.speechSynthesis.speak(utterance);
  });
}

let serverVoices: boolean | null = null;
/** After a failed AI-voice attempt, use the browser voice for a while instead of retrying every line. */
let serverVoiceCooldownUntil = 0;

/** Whether the server can synthesise AI voices (a Gemini key is configured). */
export async function serverVoicesAvailable(): Promise<boolean> {
  if (serverVoices !== null) return serverVoices;
  try {
    const res = await api<{ available: boolean }>("/api/tts", { timeoutMs: 5000 });
    serverVoices = res.available;
  } catch {
    serverVoices = false;
  }
  return serverVoices;
}

let currentStream: AbortController | null = null;

/**
 * Expressive AI voice, streamed: audio starts about a second after the request
 * and plays gap-free. If nothing arrives within 3.5 s the browser voice takes
 * over immediately, so the candidate never waits in silence.
 */
async function speakWithServer(text: string, emotion: Emotion, opts: SpeakOptions): Promise<boolean> {
  if (!opts.serverVoice || Date.now() < serverVoiceCooldownUntil || !(await serverVoicesAvailable())) return false;
  const hint: DeliveryHint = { ...opts.hint, persona: { ...opts.hint?.persona, trait: opts.hint?.persona?.trait ?? opts.style } };
  const controller = new AbortController();
  currentStream = controller;
  const signal = opts.signal ? AbortSignal.any([opts.signal, controller.signal]) : controller.signal;
  // Abort only if the response hasn't started within 3.5 s; the audio stream
  // itself may run for as long as the line takes to say.
  const headersTimer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await apiStream(
      "/api/tts/stream",
      { text: withNaturalPauses(text), voice: opts.serverVoice, style: performanceNote(emotion, hint) },
      signal
    ).finally(() => clearTimeout(headersTimer));
    if (!res.body) return false;
    const played = await playPcmStream(res.body, {
      sampleRate: Number(res.headers.get("X-Sample-Rate")) || 24_000,
      signal,
      firstAudioTimeoutMs: 3500,
      onStart: () => opts.onPhrase?.(text, 0),
      onSpeakingChange: opts.onSpeakingChange,
    });
    if (!played && !signal.aborted) {
      serverVoiceCooldownUntil = Date.now() + 60_000;
      controller.abort();
      return false;
    }
    return true;
  } catch {
    if (opts.signal?.aborted) return true;
    // Quota, network or model errors: browser voice for the next minute.
    serverVoiceCooldownUntil = Date.now() + 60_000;
    return false;
  } finally {
    if (currentStream === controller) currentStream = null;
  }
}

/** Group sentences into a few utterances (Chrome truncates very long ones). */
function utterancesOf(phrases: string[], maxChars = 230): string[] {
  const out: string[] = [];
  let current = "";
  for (const p of phrases) {
    // Keep the final question as its own utterance so it gets a small beat before it.
    const isQuestion = p.trim().endsWith("?");
    if (current && (current.length + p.length + 1 > maxChars || isQuestion)) {
      out.push(current);
      current = "";
    }
    current = current ? `${current} ${p}` : p;
  }
  if (current) out.push(current);
  return out;
}

/**
 * Speak text and resolve when finished. Always resolves — on end, error,
 * abort, or a safety timeout.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const clean = text.trim();
  if (!clean || opts.signal?.aborted) return;
  const phrases = toPhrases(clean);

  if (opts.muted || !speechSynthesisSupported()) {
    for (let i = 0; i < phrases.length && !opts.signal?.aborted; i++) {
      opts.onPhrase?.(phrases[i], i);
      await wait(900 + phrases[i].split(/\s+/).length * 230, opts.signal);
    }
    return;
  }

  const emotion = opts.emotion ?? inferEmotion(clean, opts.hint);
  if (await speakWithServer(clean, emotion, opts)) return;

  const onAbort = () => window.speechSynthesis.cancel();
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  window.speechSynthesis.cancel();
  // Few, longer utterances: each browser utterance has start-up latency (network
  // voices especially), so speaking sentence by sentence creates long gaps.
  // Emotion still sets pitch and pace; the only added pause is a short beat
  // before the question.
  const chunks = utterancesOf(phrases);
  const steps = phrasePlan(chunks, emotion, { rate: opts.rate, pitch: opts.pitch });
  for (let i = 0; i < steps.length; i++) {
    if (opts.signal?.aborted) break;
    opts.onPhrase?.(steps[i].text, i);
    await speakPhrase(steps[i].text, { ...opts, pitch: steps[i].pitch }, steps[i].rate);
    const next = steps[i + 1];
    if (next) await wait(next.text.endsWith("?") ? 180 : 60, opts.signal);
  }
  opts.signal?.removeEventListener("abort", onAbort);
}

export function cancelSpeech() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
  currentStream?.abort();
  currentStream = null;
}

// ─── Recognition language ─────────────────────────────────────────────────────

export const SPEECH_LANGS = [
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-CA", label: "English (Canada)" },
  { code: "en-SG", label: "English (Singapore)" },
  { code: "en-ZA", label: "English (South Africa)" },
] as const;

const LANG_KEY = "bbx-speech-lang";

const ZONE_ACCENT: [RegExp, string][] = [
  [/^Asia\/(Kolkata|Calcutta)$/, "en-IN"],
  [/^Europe\/(London|Belfast)$/, "en-GB"],
  [/^Australia\//, "en-AU"],
  [/^Asia\/Singapore$/, "en-SG"],
  [/^Africa\/Johannesburg$/, "en-ZA"],
];

/**
 * The candidate's chosen accent; otherwise a regional English the browser
 * lists (en-US is often just the UI default, so other regions win); otherwise
 * the time zone's region; otherwise en-US.
 */
export function getSpeechLang(): string {
  if (typeof window === "undefined") return "en-US";
  try {
    const saved = window.localStorage.getItem(LANG_KEY);
    if (saved && SPEECH_LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const supported = (code: string) => SPEECH_LANGS.find((l) => l.code.toLowerCase() === code.toLowerCase())?.code;
  const english = (navigator.languages ?? [navigator.language]).filter((l) => /^en-/i.test(l));
  const regional = english.map(supported).find((c) => c && c !== "en-US");
  if (regional) return regional;
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byZone = ZONE_ACCENT.find(([re]) => re.test(zone))?.[1];
    if (byZone) return byZone;
  } catch {
    /* Intl unavailable */
  }
  return english.map(supported).find(Boolean) ?? "en-US";
}

export function setSpeechLang(code: string) {
  try {
    window.localStorage.setItem(LANG_KEY, code);
  } catch {
    /* storage unavailable */
  }
}

// ─── Recognition ──────────────────────────────────────────────────────────────

type RecognitionCtor = new () => SpeechRecognition;

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

/** Edge's built-in recognizer only returns words after each pause; Chrome streams them live. */
export function recognitionIsDelayed(): boolean {
  return typeof navigator !== "undefined" && /\bEdg\//.test(navigator.userAgent);
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
  readonly listening: boolean;
}

/**
 * Continuous dictation. Browsers end a recognition session after silence or
 * about a minute, so the recognizer restarts itself immediately (keeping the
 * text heard so far) until stop() is called.
 */
export function createRecognizer(handlers: {
  onText: (finalText: string, interim: string) => void;
  onStateChange?: (listening: boolean) => void;
  onError?: (error: string) => void;
}): Recognizer | null {
  if (!speechRecognitionSupported()) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as RecognitionCtor;
  const lang = getSpeechLang();

  let committed = ""; // text from sessions that have ended
  let sessionFinal = ""; // final text in the current session
  let wanted = false;
  let active = false;
  let failures = 0;
  let rec: SpeechRecognition | null = null;

  const join = (...parts: string[]) => parts.join(" ").replace(/\s+/g, " ").trim();

  const boot = () => {
    rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = lang;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      failures = 0;
      // Rebuild from the whole result list: robust against browsers that
      // revise earlier results instead of appending.
      let finals = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finals += ` ${chunk}`;
        else interim += ` ${chunk}`;
      }
      sessionFinal = finals.trim();
      handlers.onText(join(committed, sessionFinal), interim.trim());
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wanted = false;
        handlers.onError?.("Microphone access was denied. You can type your answer instead.");
      } else if (event.error === "network") {
        failures += 1;
        if (failures >= 3) {
          wanted = false;
          handlers.onError?.("The speech service can't be reached from this browser. Use Chrome or Edge, or type your answer.");
        }
      } else if (event.error === "language-not-supported") {
        wanted = false;
        handlers.onError?.("Your browser doesn't support dictation in this accent. Pick another accent or type your answer.");
      }
    };
    rec.onend = () => {
      active = false;
      committed = join(committed, sessionFinal);
      sessionFinal = "";
      if (wanted) {
        try {
          boot();
          rec?.start();
          active = true;
          return;
        } catch {
          wanted = false;
        }
      }
      handlers.onStateChange?.(false);
    };
  };

  return {
    start() {
      if (wanted) return;
      committed = "";
      sessionFinal = "";
      wanted = true;
      boot();
      try {
        rec?.start();
        active = true;
        handlers.onStateChange?.(true);
      } catch {
        wanted = false;
      }
    },
    stop() {
      wanted = false;
      try {
        rec?.stop();
      } catch {
        /* already stopped */
      }
      if (!active) handlers.onStateChange?.(false);
    },
    get listening() {
      return wanted;
    },
  };
}

// ─── Audio capture for accurate transcription ─────────────────────────────────

/**
 * Records the microphone while the candidate answers so the finished answer can
 * be transcribed accurately — by Whisper on the device, or by Gemini on the
 * server when configured. Audio is downsampled to 16 kHz in the browser and is
 * never stored.
 */
export interface RecorderOptions {
  /**
   * Receives finished stretches of speech (16 kHz) during recording, cut at natural
   * pauses, so they can be transcribed while the candidate is still talking.
   */
  onSegment?: (pcm16k: Float32Array) => void;
  /** Don't cut segments shorter than this. */
  minSegmentSec?: number;
  /** Cut regardless at this length (Whisper reads 30-second windows). */
  maxSegmentSec?: number;
  /** A pause at least this long counts as a sentence boundary. */
  pauseMs?: number;
}

export class AnswerRecorder {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  /** Every block since start (capped), for one-shot server transcription of the whole answer. */
  private all: Float32Array[] = [];
  private allSamples = 0;
  private pendingSamples = 0;
  private silenceMs = 0;
  private noiseFloor = 0.01;
  private sampleRate = 48_000;
  private options: RecorderOptions = {};
  /** Whether any segment was already handed to onSegment. */
  segmentsEmitted = 0;

  async start(options: RecorderOptions = {}): Promise<boolean> {
    this.options = options;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.context = new AudioContext();
      this.sampleRate = this.context.sampleRate;
      const source = this.context.createMediaStreamSource(this.stream);
      this.node = this.context.createScriptProcessor(4096, 1, 1);
      this.chunks = [];
      this.all = [];
      this.allSamples = 0;
      this.pendingSamples = 0;
      this.segmentsEmitted = 0;
      this.node.onaudioprocess = (e) => this.onAudio(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(this.node);
      this.node.connect(this.context.destination);
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  private onAudio(block: Float32Array) {
    this.chunks.push(block);
    this.pendingSamples += block.length;
    if (this.allSamples < this.sampleRate * 240) {
      this.all.push(block);
      this.allSamples += block.length;
    }
    const { onSegment, minSegmentSec = 6, maxSegmentSec = 25, pauseMs = 550 } = this.options;
    if (!onSegment) return;

    // Simple voice-activity detection against an adaptive noise floor.
    let sum = 0;
    for (let i = 0; i < block.length; i++) sum += block[i] * block[i];
    const rms = Math.sqrt(sum / block.length);
    // The floor follows quiet moments quickly and creeps up only slowly (and is capped),
    // so long stretches of steady speech are never mistaken for background noise.
    this.noiseFloor = rms < this.noiseFloor ? rms * 0.3 + this.noiseFloor * 0.7 : Math.min(this.noiseFloor * 1.002, 0.03);
    const silent = rms < Math.max(0.006, this.noiseFloor * 2.2);
    const blockMs = (block.length / this.sampleRate) * 1000;
    this.silenceMs = silent ? this.silenceMs + blockMs : 0;

    const seconds = this.pendingSamples / this.sampleRate;
    if ((seconds >= minSegmentSec && this.silenceMs >= pauseMs) || seconds >= maxSegmentSec) {
      const pcm = this.drain();
      this.segmentsEmitted += 1;
      onSegment(resampleTo16k(pcm, this.sampleRate));
    }
  }

  private drain(maxSeconds = 300): Float32Array {
    const total = Math.min(this.pendingSamples, this.sampleRate * maxSeconds);
    const pcm = new Float32Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      if (offset >= total) break;
      pcm.set(c.subarray(0, total - offset), offset);
      offset += c.length;
    }
    this.chunks = [];
    this.pendingSamples = 0;
    return pcm;
  }

  /**
   * Stop and return the not-yet-segmented audio at 16 kHz, or null when there is
   * too little to transcribe (under 1.5 s, or 0.3 s after earlier segments).
   */
  stopPcm(maxSeconds = 300): Float32Array | null {
    const rate = this.sampleRate;
    const minSeconds = this.segmentsEmitted ? 0.3 : 1.5;
    const enough = this.pendingSamples >= rate * minSeconds;
    const pcm = enough ? this.drain(maxSeconds) : null;
    this.dispose();
    return pcm ? resampleTo16k(pcm, rate) : null;
  }

  /**
   * Stop and return both the untranscribed tail (for on-device segments) and the
   * whole answer (for one-shot server transcription), at 16 kHz.
   */
  stopAll(): { tail: Float32Array | null; full: Float32Array | null } {
    const rate = this.sampleRate;
    let full: Float32Array | null = null;
    if (this.allSamples >= rate * 1.2) {
      const merged = new Float32Array(this.allSamples);
      let o = 0;
      for (const b of this.all) {
        merged.set(b, o);
        o += b.length;
      }
      full = resampleTo16k(merged, rate);
    }
    this.all = [];
    this.allSamples = 0;
    const tail = this.stopPcm();
    return { tail, full };
  }

  /** Stop and return base64 WAV (16 kHz mono), or null if nothing usable was captured. */
  stop(maxSeconds = 240): string | null {
    const pcm = this.stopPcm(maxSeconds);
    return pcm ? wavBase64(pcm) : null;
  }

  dispose() {
    this.node?.disconnect();
    if (this.node) this.node.onaudioprocess = null;
    this.node = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.chunks = [];
    this.all = [];
    this.allSamples = 0;
    this.pendingSamples = 0;
  }
}

/** Downsample to 16 kHz by averaging the source samples in each output sample (a simple low-pass). */
export function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  const ratio = inputRate / 16_000;
  if (ratio <= 1) return input;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

/** 16 kHz mono float samples → base64 16-bit PCM WAV. */
export function wavBase64(pcm: Float32Array): string {
  const rate = 16_000;
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const FILLER_RE = /\b(um+|uh+|erm|like|you know|basically|literally|actually|kind of|sort of)\b/gi;

export function countFillers(text: string): number {
  return text.match(FILLER_RE)?.length ?? 0;
}
