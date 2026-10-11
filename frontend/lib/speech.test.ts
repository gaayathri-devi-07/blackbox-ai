import { describe, expect, it } from "vitest";
import { AnswerRecorder, resampleTo16k, wavBase64 } from "./speech";

const RATE = 48_000;
const BLOCK = 4096;

/** Feed synthetic audio blocks straight into the recorder's processing path. */
function feed(recorder: AnswerRecorder, seconds: number, amplitude: number) {
  const blocks = Math.round((seconds * RATE) / BLOCK);
  for (let b = 0; b < blocks; b++) {
    const block = new Float32Array(BLOCK);
    for (let i = 0; i < BLOCK; i++) {
      const t = (b * BLOCK + i) / RATE;
      // Speech-like: a 220 Hz voice whose loudness rises and falls ~4 times a second (syllables).
      const envelope = 0.25 + 0.75 * Math.abs(Math.sin(2 * Math.PI * 2 * t));
      block[i] = amplitude * envelope * Math.sin(2 * Math.PI * 220 * t);
    }
    (recorder as unknown as { onAudio(b: Float32Array): void }).onAudio(block);
  }
}

function recorderWith(onSegment: (pcm: Float32Array) => void) {
  const r = new AnswerRecorder();
  Object.assign(r as unknown as Record<string, unknown>, { options: { onSegment }, sampleRate: RATE });
  return r;
}

describe("AnswerRecorder segmentation", () => {
  it("cuts a segment at a pause after enough speech", () => {
    const segments: Float32Array[] = [];
    const r = recorderWith((pcm) => segments.push(pcm));
    feed(r, 7, 0.2); // speech
    expect(segments).toHaveLength(0);
    feed(r, 0.8, 0); // pause
    expect(segments).toHaveLength(1);
    // ~7.8 s of audio at 16 kHz
    expect(segments[0].length / 16_000).toBeGreaterThan(7);
    expect(segments[0].length / 16_000).toBeLessThan(8.5);
  });

  it("does not cut on short pauses inside the minimum length", () => {
    const segments: Float32Array[] = [];
    const r = recorderWith((pcm) => segments.push(pcm));
    feed(r, 2, 0.2);
    feed(r, 0.8, 0);
    feed(r, 2, 0.2);
    expect(segments).toHaveLength(0);
  });

  it("cuts long uninterrupted speech at the maximum length", () => {
    const segments: Float32Array[] = [];
    const r = recorderWith((pcm) => segments.push(pcm));
    feed(r, 26, 0.2);
    expect(segments).toHaveLength(1);
    expect(segments[0].length / 16_000).toBeLessThanOrEqual(25.2);
  });
});

describe("audio helpers", () => {
  it("resamples 48 kHz to 16 kHz", () => {
    expect(resampleTo16k(new Float32Array(48_000), 48_000)).toHaveLength(16_000);
  });

  it("encodes a valid WAV header", () => {
    const bytes = Uint8Array.from(atob(wavBase64(new Float32Array(1600))), (c) => c.charCodeAt(0));
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.length).toBe(44 + 1600 * 2);
  });
});
