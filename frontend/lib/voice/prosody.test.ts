import { describe, expect, it } from "vitest";
import { inferEmotion, performanceNote, phrasePlan, withNaturalPauses } from "./prosody";

describe("inferEmotion", () => {
  it("reassures when coaching and warms up the opening", () => {
    expect(inferEmotion("Let me give you a hint.", { move: "coaching" })).toBe("empathetic");
    expect(inferEmotion("Hello, welcome to the interview.", { move: "opening" })).toBe("warm");
  });

  it("sounds curious on follow-ups and direct under pressure", () => {
    expect(inferEmotion("Why Kafka?", { move: "followup" })).toBe("curious");
    expect(inferEmotion("What if the region fails?", { mode: "PRESSURE" })).toBe("serious");
  });
});

describe("withNaturalPauses", () => {
  it("adds a light beat after a discourse marker without long ellipsis pauses", () => {
    const out = withNaturalPauses("Okay that makes sense. You used Redis for the cache. How did you invalidate it?");
    expect(out.startsWith("Okay, ")).toBe(true);
    expect(out).not.toContain("…");
    expect(out).toContain("How did you invalidate it?");
  });
});

describe("phrasePlan", () => {
  const fixed = () => 0.5;

  it("splits a leading marker into its own beat and pauses before the question", () => {
    const steps = phrasePlan(["Great, that was a clear explanation of the trade-off.", "How would you scale it?"], "encouraging", {}, fixed);
    expect(steps.map((s) => s.text)).toEqual(["Great,", "that was a clear explanation of the trade-off.", "How would you scale it?"]);
    // The sentence before the question carries the longest pause; the last phrase has none.
    expect(steps[1].pauseAfterMs).toBeGreaterThan(steps[0].pauseAfterMs);
    expect(steps.at(-1)?.pauseAfterMs).toBe(0);
  });

  it("slows down and pauses longer when reassuring", () => {
    const calm = phrasePlan(["That's okay.", "Think about the cache first."], "empathetic", {}, fixed);
    const brisk = phrasePlan(["That's okay.", "Think about the cache first."], "serious", {}, fixed);
    expect(calm[0].rate).toBeLessThan(brisk[0].rate);
    expect(calm[0].pauseAfterMs).toBeGreaterThan(brisk[0].pauseAfterMs);
  });
});

describe("performanceNote", () => {
  it("directs tone and pauses for Gemini TTS", () => {
    const note = performanceNote("empathetic", { role: "interviewer", persona: { name: "Priya" } });
    expect(note).toContain("Priya");
    expect(note).toContain("reassuring");
    expect(note).toMatch(/short pauses/);
  });
});
