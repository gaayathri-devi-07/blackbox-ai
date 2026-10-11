"use client";

/**
 * Plays streamed 16-bit PCM (from /api/tts/stream) with the Web Audio API.
 *
 * Chunks are scheduled back to back on the audio clock, so there are no gaps
 * between them, and an analyser reports when sound is actually coming out —
 * the interviewer's mouth moves with the audio, not with the network.
 */

let sharedContext: AudioContext | null = null;

/** One AudioContext for the page; resumed on the first user gesture. */
export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedContext = new Ctor({ latencyHint: "interactive" });
  }
  return sharedContext;
}

/** Call from a click handler (e.g. "Begin interview") so later playback is allowed. */
export function unlockAudio(): void {
  void audioContext()?.resume().catch(() => undefined);
}

export interface StreamPlayOptions {
  sampleRate: number;
  signal?: AbortSignal;
  /** Fired when the first audio actually starts playing. */
  onStart?: () => void;
  /** True while audible speech is coming out, false during pauses (debounced). */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Resolve false if no audio arrives within this many ms (caller falls back). */
  firstAudioTimeoutMs?: number;
}

/**
 * Play a PCM byte stream. Resolves true when playback finished (or was
 * aborted), false when no audio arrived in time — nothing was played then.
 */
export async function playPcmStream(body: ReadableStream<Uint8Array>, opts: StreamPlayOptions): Promise<boolean> {
  const ctx = audioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

  const reader = body.getReader();
  const gain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  gain.connect(analyser);
  analyser.connect(ctx.destination);

  const sources: AudioBufferSourceNode[] = [];
  let nextTime = 0;
  let started = false;
  let carry: Uint8Array | null = null;
  // Collect ~150 ms before the first schedule so early network jitter can't cause a gap.
  const primeSamples = Math.round(opts.sampleRate * 0.15);
  let pending: Float32Array[] = [];
  let pendingSamples = 0;

  const toFloat = (bytes: Uint8Array): Float32Array => {
    let data = bytes;
    if (carry) {
      const merged = new Uint8Array(carry.length + bytes.length);
      merged.set(carry);
      merged.set(bytes, carry.length);
      data = merged;
      carry = null;
    }
    const usable = data.length - (data.length % 2);
    if (usable < data.length) carry = data.slice(usable);
    const view = new DataView(data.buffer, data.byteOffset, usable);
    const out = new Float32Array(usable / 2);
    for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768;
    return out;
  };

  const schedule = (samples: Float32Array) => {
    if (!samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, opts.sampleRate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    const at = Math.max(nextTime, ctx.currentTime + 0.04);
    src.start(at);
    nextTime = at + buffer.duration;
    sources.push(src);
    if (!started) {
      started = true;
      const delay = Math.max(0, (at - ctx.currentTime) * 1000);
      setTimeout(() => opts.onStart?.(), delay);
    }
  };

  const flush = () => {
    if (!pendingSamples) return;
    const merged = new Float32Array(pendingSamples);
    let o = 0;
    for (const p of pending) {
      merged.set(p, o);
      o += p.length;
    }
    pending = [];
    pendingSamples = 0;
    schedule(merged);
  };

  // Lip-sync: report audible speech from the analyser, with a short hold so the
  // mouth doesn't flicker between words.
  let speaking = false;
  let lastLoud = 0;
  let meter: ReturnType<typeof setInterval> | null = null;
  const level = new Uint8Array(analyser.fftSize);
  const tick = () => {
    analyser.getByteTimeDomainData(level);
    let sum = 0;
    for (let i = 0; i < level.length; i++) {
      const v = (level[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / level.length);
    const now = performance.now();
    if (rms > 0.02) lastLoud = now;
    const next = now - lastLoud < 260;
    if (next !== speaking) {
      speaking = next;
      opts.onSpeakingChange?.(speaking);
    }
  };
  // A timer rather than requestAnimationFrame, which browsers pause in background tabs.
  meter = setInterval(tick, 40);

  const stopAll = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
  };
  const onAbort = () => {
    stopAll();
    void reader.cancel().catch(() => undefined);
  };
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  let timedOut = false;
  const firstTimer = opts.firstAudioTimeoutMs
    ? setTimeout(() => {
        if (!started && !pendingSamples) {
          timedOut = true;
          void reader.cancel().catch(() => undefined);
        }
      }, opts.firstAudioTimeoutMs)
    : null;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done || opts.signal?.aborted) break;
      if (!value?.length) continue;
      const samples = toFloat(value);
      if (!started) {
        pending.push(samples);
        pendingSamples += samples.length;
        if (pendingSamples >= primeSamples) flush();
      } else {
        schedule(samples);
      }
    }
    if (!opts.signal?.aborted) flush();
  } catch {
    /* network error mid-stream: play what we have */
  } finally {
    if (firstTimer) clearTimeout(firstTimer);
  }

  if (timedOut && !started) {
    if (meter) clearInterval(meter);
    opts.signal?.removeEventListener("abort", onAbort);
    return false;
  }

  // Wait for the scheduled audio to finish (or an abort).
  if (started && !opts.signal?.aborted) {
    const remainingMs = Math.max(0, (nextTime - ctx.currentTime) * 1000);
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, remainingMs + 60);
      opts.signal?.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
    });
  }
  if (meter) clearInterval(meter);
  if (speaking) opts.onSpeakingChange?.(false);
  opts.signal?.removeEventListener("abort", onAbort);
  gain.disconnect();
  analyser.disconnect();
  return started;
}
