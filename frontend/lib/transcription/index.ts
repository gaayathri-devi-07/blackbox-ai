"use client";

import { useSyncExternalStore } from "react";
import type { WhisperRequest, WhisperResponse, WhisperRuntime } from "./whisper.worker";

/**
 * Accurate transcription of a finished answer.
 *
 * While the candidate speaks, the browser's recognizer shows live captions.
 * When they finish, the recorded audio is transcribed again by Whisper running
 * on the device (or by Gemini on the server when configured), which is far more
 * accurate for accents and technical vocabulary. The result is then shown for
 * review and editing before it is submitted.
 */

export type TranscriptionQuality = "standard" | "high" | "off";

export const TRANSCRIPTION_OPTIONS: Record<TranscriptionQuality, { label: string; detail: string; model: string | null; sizeMb: number }> = {
  standard: {
    label: "Accurate (recommended)",
    detail: "Whisper base, on your device. One-time download of about 80 MB.",
    model: "onnx-community/whisper-base.en",
    sizeMb: 80,
  },
  high: {
    label: "Most accurate",
    detail: "Whisper small, on your device. One-time download of about 250 MB; slower on older laptops.",
    model: "onnx-community/whisper-small.en",
    sizeMb: 250,
  },
  off: {
    label: "Live captions only",
    detail: "Uses only the browser's built-in recognizer. Fastest, least accurate.",
    model: null,
    sizeMb: 0,
  },
};

const QUALITY_KEY = "bbx-transcription";

export function getTranscriptionQuality(): TranscriptionQuality {
  try {
    const saved = window.localStorage.getItem(QUALITY_KEY);
    if (saved === "standard" || saved === "high" || saved === "off") return saved;
  } catch {
    /* storage unavailable */
  }
  return "standard";
}

export function setTranscriptionQuality(quality: TranscriptionQuality) {
  try {
    window.localStorage.setItem(QUALITY_KEY, quality);
  } catch {
    /* storage unavailable */
  }
  localTranscriber.reset();
}

export interface TranscriberState {
  status: "idle" | "loading" | "ready" | "error" | "unsupported";
  progress: number;
  loadedMb: number;
  totalMb: number;
  error: string | null;
  /** Which device/precision the model runs with, for diagnostics. */
  runtime: string | null;
}

const IDLE: TranscriberState = { status: "idle", progress: 0, loadedMb: 0, totalMb: 0, error: null, runtime: null };

class LocalTranscriber {
  private worker: Worker | null = null;
  private model: string | null = null;
  private state: TranscriberState = IDLE;
  private listeners = new Set<() => void>();
  private nextId = 1;
  private pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = () => this.state;
  private set(patch: Partial<TranscriberState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  /** Start downloading the selected model in the background. Safe to call repeatedly. */
  prepare(runtime?: WhisperRuntime) {
    if (typeof window === "undefined") return;
    const option = TRANSCRIPTION_OPTIONS[getTranscriptionQuality()];
    if (!option.model) {
      this.reset();
      return;
    }
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
      this.set({ status: "unsupported" });
      return;
    }
    if (this.worker && this.model === option.model && this.state.status !== "error") return;
    this.reset();
    this.model = option.model;
    this.worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WhisperResponse>) => this.handle(event.data);
    this.worker.onerror = () => this.set({ status: "error", error: "The transcription engine failed to start." });
    this.set({ status: "loading", progress: 0, error: null });
    this.send({ type: "load", model: option.model, runtime });
  }

  private send(message: WhisperRequest, transfer: Transferable[] = []) {
    this.worker?.postMessage(message, transfer);
  }

  private handle(msg: WhisperResponse) {
    switch (msg.type) {
      case "progress":
        this.set({ progress: msg.progress, loadedMb: Math.round(msg.loaded / 1e6), totalMb: Math.round(msg.total / 1e6) });
        break;
      case "ready":
        this.set({ status: "ready", progress: 100, runtime: msg.runtime });
        break;
      case "result":
        this.pending.get(msg.id)?.resolve(msg.text);
        this.pending.delete(msg.id);
        break;
      case "error":
        if (msg.id !== undefined) {
          this.pending.get(msg.id)?.reject(new Error(msg.message));
          this.pending.delete(msg.id);
        } else {
          this.set({ status: "error", error: msg.message });
        }
        break;
    }
  }

  /** Wait (up to `timeoutMs`) for the model, then transcribe 16 kHz mono audio. */
  async transcribe(audio: Float32Array, timeoutMs = 90_000): Promise<string> {
    if (!this.worker) throw new Error("Transcription is not enabled.");
    const started = Date.now();
    while (this.state.status === "loading" && Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (this.state.status !== "ready") throw new Error(this.state.error ?? "The transcription model isn't ready.");
    if (isSilent(audio)) return "";
    const id = this.nextId++;
    const text = await new Promise<string>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: "transcribe", id, audio }, [audio.buffer]);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("Transcription took too long."));
        }
      }, timeoutMs);
    });
    return cleanWhisperText(text);
  }

  reset() {
    this.worker?.terminate();
    this.worker = null;
    this.model = null;
    for (const p of this.pending.values()) p.reject(new Error("Transcription was reset."));
    this.pending.clear();
    this.set(IDLE);
  }
}

/** Whisper invents phrases like "Thank you." on silence; skip near-silent audio. */
function isSilent(audio: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < audio.length; i++) sum += audio[i] * audio[i];
  return Math.sqrt(sum / Math.max(1, audio.length)) < 0.004;
}

/** Remove non-speech tags such as [BLANK_AUDIO] or (music) and tidy spacing. */
export function cleanWhisperText(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*(music|silence|blank|inaudible|applause)[^)]*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const localTranscriber = new LocalTranscriber();

export function useLocalTranscriber(): TranscriberState {
  return useSyncExternalStore(localTranscriber.subscribe, localTranscriber.getState, () => IDLE);
}

// Development-only handle for manual testing from the browser console.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __bbxTranscriber?: LocalTranscriber }).__bbxTranscriber = localTranscriber;
}
