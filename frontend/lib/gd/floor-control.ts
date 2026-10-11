/**
 * Floor control for the group discussion room.
 *
 * A single exclusive lock decides who may speak. The rules:
 *
 *   IDLE       Discussion hasn't started. Nobody may request the floor.
 *   MODERATOR  The moderator holds the floor (introducing, asking a question).
 *              Every participant is WAITING; requests are rejected.
 *   OPEN       The moderator has opened the floor. Participants may request a
 *              turn; requests queue in arrival order. Nobody speaks until the
 *              orchestrator grants the head of the queue.
 *   LOCKED     One participant holds the lock. Everyone else is WAITING:
 *              requests are rejected, so no one can interrupt or raise a
 *              response until the holder releases.
 *   CLOSED     Discussion over. Everything is rejected.
 *
 * Releasing re-opens the floor; queued participants are then granted one at a
 * time (sequential hand-off). Each grant carries a monotonically increasing
 * token, so a slow asynchronous turn (e.g. an AI response arriving late) can
 * never release, or speak under, a lock it no longer holds.
 *
 * Pure TypeScript with no timers or I/O — the orchestrator owns timing.
 */

export type FloorState = "IDLE" | "MODERATOR" | "OPEN" | "LOCKED" | "CLOSED";
export type ParticipantStatus = "idle" | "queued" | "waiting" | "speaking";
export type RequestResult =
  | { ok: true; position: number }
  | { ok: false; reason: "locked" | "closed" | "not-open" | "holder" | "unknown-participant" };

export interface FloorSnapshot {
  readonly state: FloorState;
  /** Participant id holding the lock, "moderator", or null. */
  readonly holder: string | null;
  /** Participants waiting for a turn, in grant order. */
  readonly queue: readonly string[];
  /** Token of the current lock; increments on every grant. */
  readonly token: number;
  /** Completed participant turns. */
  readonly turns: number;
  /** When the floor last became OPEN (ms), for bidding windows. */
  readonly openedAt: number | null;
}

export const MODERATOR_ID = "moderator";

type Listener = (snapshot: FloorSnapshot) => void;

export class FloorController {
  private snapshot: FloorSnapshot = { state: "IDLE", holder: null, queue: [], token: 0, turns: 0, openedAt: null };
  private readonly listeners = new Set<Listener>();
  private readonly participants: ReadonlySet<string>;

  constructor(participantIds: string[], private readonly now: () => number = Date.now) {
    this.participants = new Set(participantIds);
  }

  // ── Store protocol (works with React's useSyncExternalStore) ────────────────

  getSnapshot = (): FloorSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<FloorSnapshot>) {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch, queue: Object.freeze([...(patch.queue ?? this.snapshot.queue)]) });
    for (const listener of this.listeners) listener(this.snapshot);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  statusOf(id: string): ParticipantStatus {
    const { state, holder, queue } = this.snapshot;
    if (holder === id) return "speaking";
    if (queue.includes(id)) return "queued";
    if (state === "LOCKED" || state === "MODERATOR") return "waiting";
    return "idle";
  }

  /** True while `id` still holds the lock identified by `token`. */
  holds(id: string, token: number): boolean {
    const s = this.snapshot;
    return s.holder === id && s.token === token && (s.state === "LOCKED" || s.state === "MODERATOR");
  }

  canRequest(id: string): boolean {
    return this.snapshot.state === "OPEN" && this.participants.has(id) && !this.snapshot.queue.includes(id);
  }

  // ── Moderator ───────────────────────────────────────────────────────────────

  /** The moderator takes the floor. Not allowed while a participant holds the lock. */
  moderatorTakeFloor(): number | null {
    const { state } = this.snapshot;
    if (state === "LOCKED" || state === "CLOSED" || state === "MODERATOR") return null;
    const token = this.snapshot.token + 1;
    this.set({ state: "MODERATOR", holder: MODERATOR_ID, token, openedAt: null });
    return token;
  }

  /** The moderator finishes speaking and opens the floor to participants. */
  moderatorOpenFloor(token: number): boolean {
    if (!this.holds(MODERATOR_ID, token)) return false;
    this.set({ state: "OPEN", holder: null, openedAt: this.now() });
    return true;
  }

  // ── Participants ────────────────────────────────────────────────────────────

  /**
   * Ask for a turn. Only possible while the floor is OPEN; while it is LOCKED or
   * held by the moderator, participants are WAITING and the request is refused.
   */
  requestFloor(id: string): RequestResult {
    const { state, holder, queue } = this.snapshot;
    if (!this.participants.has(id)) return { ok: false, reason: "unknown-participant" };
    if (state === "CLOSED") return { ok: false, reason: "closed" };
    if (holder === id) return { ok: false, reason: "holder" };
    if (state === "LOCKED" || state === "MODERATOR") return { ok: false, reason: "locked" };
    if (state !== "OPEN") return { ok: false, reason: "not-open" };

    const existing = queue.indexOf(id);
    if (existing >= 0) return { ok: true, position: existing + 1 };
    this.set({ queue: [...queue, id] });
    return { ok: true, position: queue.length + 1 };
  }

  /** Leave the queue before being granted the floor. */
  withdraw(id: string): boolean {
    if (!this.snapshot.queue.includes(id)) return false;
    this.set({ queue: this.snapshot.queue.filter((q) => q !== id) });
    return true;
  }

  /** Grant the floor to the head of the queue (sequential hand-off). */
  grantNext(): { id: string; token: number } | null {
    const { state, queue } = this.snapshot;
    if (state !== "OPEN" || queue.length === 0) return null;
    const [id, ...rest] = queue;
    const token = this.snapshot.token + 1;
    this.set({ state: "LOCKED", holder: id, queue: rest, token, openedAt: null });
    return { id, token };
  }

  /** Moderator-directed grant: give a specific participant the floor now. */
  invite(id: string): { id: string; token: number } | null {
    if (this.snapshot.state !== "OPEN" || !this.participants.has(id)) return null;
    const token = this.snapshot.token + 1;
    this.set({
      state: "LOCKED",
      holder: id,
      queue: this.snapshot.queue.filter((q) => q !== id),
      token,
      openedAt: null,
    });
    return { id, token };
  }

  /** The holder finishes. Stale tokens are ignored. */
  release(id: string, token: number): boolean {
    if (id === MODERATOR_ID || !this.holds(id, token)) return false;
    this.set({ state: "OPEN", holder: null, turns: this.snapshot.turns + 1, openedAt: this.now() });
    return true;
  }

  /** Watchdog: end the current participant's turn regardless of token. */
  forceRelease(): string | null {
    const { state, holder } = this.snapshot;
    if (state !== "LOCKED" || !holder) return null;
    this.set({ state: "OPEN", holder: null, turns: this.snapshot.turns + 1, openedAt: this.now() });
    return holder;
  }

  /** End the discussion. All pending and future operations are refused. */
  close(): void {
    if (this.snapshot.state === "CLOSED") return;
    this.set({ state: "CLOSED", holder: null, queue: [], openedAt: null, token: this.snapshot.token + 1 });
  }
}
