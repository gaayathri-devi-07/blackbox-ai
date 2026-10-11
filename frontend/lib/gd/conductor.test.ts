import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscussionConductor, type ConductorDeps, type TranscriptEntry } from "./conductor";
import type { GDAgentId } from "./agents";

/** Deterministic PRNG so bidding behaviour is reproducible. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

function abortable(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

interface Harness {
  conductor: DiscussionConductor;
  maxConcurrentSpeech: () => number;
  completions: { transcript: TranscriptEntry[]; duration: number }[];
}

function harness(overrides: Partial<ConductorDeps> = {}, timing = {}): Harness {
  let speaking = 0;
  let maxSpeaking = 0;
  const completions: Harness["completions"] = [];
  const counters: Record<string, number> = {};
  const deps: ConductorDeps = {
    agentTurn: async (id: GDAgentId, _history, signal) => {
      await abortable(300, signal);
      counters[id] = (counters[id] ?? 0) + 1;
      return `${id} point ${counters[id]}`;
    },
    followUp: async (_h, signal) => {
      await abortable(200, signal);
      return "What would change your mind?";
    },
    speak: async (_text, _speaker, signal) => {
      speaking++;
      maxSpeaking = Math.max(maxSpeaking, speaking);
      await abortable(1000, signal);
      speaking--;
    },
    onComplete: (transcript, duration) => completions.push({ transcript, duration }),
    now: () => Date.now(),
    random: seeded(42),
    ...overrides,
  };
  return { conductor: new DiscussionConductor("Test topic.", deps, timing), maxConcurrentSpeech: () => maxSpeaking, completions };
}

async function advanceUntil(predicate: () => boolean, maxMs = 120_000, step = 50) {
  for (let elapsed = 0; elapsed < maxMs; elapsed += step) {
    if (predicate()) return;
    await vi.advanceTimersByTimeAsync(step);
  }
  throw new Error("Condition not reached in simulated time");
}

describe("DiscussionConductor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a full discussion with exactly one speaker at a time", async () => {
    const h = harness();
    // Simulated candidate: answers two seconds after being given the floor.
    let lastUserToken = -1;
    h.conductor.floor.subscribe((s) => {
      if (s.holder === "user" && s.token !== lastUserToken) {
        lastUserToken = s.token;
        setTimeout(() => h.conductor.finishUserTurn("Here is my contribution."), 2_000);
      }
    });
    void h.conductor.start();

    await advanceUntil(() => h.conductor.getState().phase === "ended", 600_000);

    expect(h.maxConcurrentSpeech()).toBe(1);
    expect(h.completions).toHaveLength(1);
    const participantTurns = h.completions[0].transcript.filter((t) => t.speakerId !== "moderator");
    expect(participantTurns.length).toBe(10);
    // Follow-up questions are interleaved by the moderator.
    expect(h.completions[0].transcript.filter((t) => t.text === "What would change your mind?").length).toBeGreaterThan(0);
    expect(h.conductor.getState().floor.state).toBe("CLOSED");
    h.conductor.dispose();
  });

  it("keeps the user WAITING while an agent holds the floor, then grants their request", async () => {
    const h = harness();
    void h.conductor.start();

    await advanceUntil(() => h.conductor.getState().floor.state === "LOCKED");
    const holder = h.conductor.getState().floor.holder;
    expect(holder).not.toBe("user");
    expect(h.conductor.floor.statusOf("user")).toBe("waiting");
    expect(h.conductor.requestFloor()).toEqual({ ok: false, reason: "locked" });

    // As soon as the floor re-opens the user can request it and is granted in turn.
    await advanceUntil(() => h.conductor.getState().floor.state === "OPEN");
    expect(h.conductor.requestFloor().ok).toBe(true);
    await advanceUntil(() => h.conductor.getState().floor.holder === "user");

    // Nobody can take the floor from the user.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.conductor.getState().floor.holder).toBe("user");

    h.conductor.finishUserTurn("I think we need clear accountability.");
    const t = h.conductor.getState().transcript;
    expect(t[t.length - 1]).toMatchObject({ speakerId: "user", text: "I think we need clear accountability." });
    expect(h.conductor.getState().floor.state).toBe("OPEN");
    h.conductor.dispose();
  });

  it("grants queued participants in request order", async () => {
    const h = harness({ random: () => 0.99 }); // agents never bid on their own
    void h.conductor.start();
    await advanceUntil(() => h.conductor.getState().floor.state === "OPEN");

    h.conductor.floor.requestFloor("ai3");
    h.conductor.requestFloor();
    h.conductor.floor.requestFloor("ai1");

    const order: string[] = [];
    h.conductor.floor.subscribe((s) => {
      if (s.state === "LOCKED" && s.holder && order[order.length - 1] !== s.holder) order.push(s.holder);
    });
    await advanceUntil(() => h.conductor.getState().floor.holder === "user");
    h.conductor.finishUserTurn("My view.");
    await advanceUntil(() => order.length >= 3);
    expect(order.slice(0, 3)).toEqual(["ai3", "user", "ai1"]);
    h.conductor.dispose();
  });

  it("drops an AI response that arrives after its turn was revoked", async () => {
    const h = harness(
      {
        agentTurn: async (id, _h, signal) => {
          await abortable(10_000, signal);
          return `${id} late point`;
        },
      },
      { aiTurnMaxMs: 2_000 }
    );
    void h.conductor.start();
    await advanceUntil(() => h.conductor.getState().floor.state === "LOCKED");
    await vi.advanceTimersByTimeAsync(2_100);

    expect(h.conductor.getState().floor.state).not.toBe("LOCKED");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.conductor.getState().transcript.some((t) => t.text.includes("late point"))).toBe(false);
    h.conductor.dispose();
  });

  it("invites a quiet participant after a silent opening", async () => {
    const h = harness({ random: () => 0.99 }, { silenceMs: 3_000 });
    void h.conductor.start();
    await advanceUntil(() => h.conductor.getState().floor.state === "OPEN");
    await advanceUntil(() => h.conductor.getState().floor.state === "LOCKED", 20_000);
    expect(h.conductor.getState().transcript.some((t) => t.speakerId === "moderator" && /what's your view/i.test(t.text))).toBe(true);
    h.conductor.dispose();
  });

  it("closes cleanly when stopped mid-turn", async () => {
    const h = harness();
    void h.conductor.start();
    await advanceUntil(() => h.conductor.getState().floor.state === "LOCKED");
    h.conductor.stop();
    await advanceUntil(() => h.conductor.getState().phase === "ended");
    expect(h.conductor.getState().floor.state).toBe("CLOSED");
    expect(h.completions).toHaveLength(1);
    expect(h.conductor.requestFloor()).toEqual({ ok: false, reason: "closed" });
    h.conductor.dispose();
  });

  it("lets the opposing panelist listen and draft while the floor is locked", async () => {
    const calls: { id: GDAgentId; holder: string | null; length: number }[] = [];
    const h: Harness = harness({
      agentTurn: async (id, history, signal) => {
        calls.push({ id, holder: h.conductor.floor.getSnapshot().holder, length: history.length });
        await abortable(300, signal);
        return { text: `${id} responds`, move: "rebut", respondingTo: "Alex" };
      },
    });
    void h.conductor.start();
    // Wait until the Optimist (ai1) has spoken at least once.
    await advanceUntil(() => h.conductor.getState().transcript.some((t) => t.speakerId === "ai1"));
    // While ai1 held the floor, the Skeptic (ai3) was already drafting its reply.
    const ai1Line = h.conductor.getState().transcript.findIndex((t) => t.speakerId === "ai1");
    const draftedWhileLocked = calls.find((c) => c.id === "ai3" && c.holder === "ai1" && c.length === ai1Line + 1);
    expect(draftedWhileLocked).toBeDefined();
    // Only one participant ever speaks at a time, even with drafting in parallel.
    expect(h.maxConcurrentSpeech()).toBe(1);
    h.conductor.dispose();
  });
});
