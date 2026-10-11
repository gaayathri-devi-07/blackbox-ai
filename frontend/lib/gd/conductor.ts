/**
 * Discussion conductor — runs a live group discussion on top of FloorController.
 *
 *  1. The moderator introduces the topic (floor MODERATOR), then opens it (OPEN).
 *  2. While OPEN, the user and AI candidates may request the floor. Requests in
 *     the same opening are collected for a short bidding window, then the floor
 *     is granted to the first requester (LOCKED). Others stay queued.
 *  3. While LOCKED nobody else can speak or request; everyone else is WAITING.
 *  4. When the holder releases, the floor re-opens and queued participants are
 *     granted one at a time after a short hand-off gap.
 *  5. The moderator steps in between turns for follow-up questions, nudges quiet
 *     participants after silence, and closes the discussion after MAX turns.
 *
 * All I/O (model calls, text-to-speech, timers, randomness) is injected so the
 * conductor can be driven deterministically in tests.
 */
import { FloorController, MODERATOR_ID, type FloorSnapshot } from "./floor-control";
import { GD_AGENTS, GD_AGENT_IDS, GD_MODERATOR, naturalResponder, type GDAgentId } from "./agents";

export interface TranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  at: number;
}

export type AgentActivity = "idle" | "queued" | "waiting" | "preparing" | "speaking";

export interface ConductorState {
  phase: "idle" | "intro" | "live" | "wrapping" | "ended";
  floor: FloorSnapshot;
  transcript: TranscriptEntry[];
  moderator: { line: string | null; speaking: boolean; preparing: boolean };
  agents: Record<GDAgentId, { activity: AgentActivity; turns: number; line: string | null; intent: string | null; drafting: boolean }>;
  user: { turns: number; turnStartedAt: number | null };
  /** One-line description of what is happening, for the status bar. */
  notice: string;
  startedAt: number | null;
}

/** An agent's contribution, optionally with what it is doing ("Rebutting Maya"). */
export type AgentTurnOutput = string | { text: string; move?: string; respondingTo?: string | null };

export interface ConductorDeps {
  agentTurn: (agentId: GDAgentId, history: TranscriptEntry[], signal: AbortSignal) => Promise<AgentTurnOutput>;
  followUp: (history: TranscriptEntry[], signal: AbortSignal) => Promise<string>;
  /** Speak a line; must resolve when finished or when the signal aborts. */
  speak: (text: string, speakerId: string, signal: AbortSignal) => Promise<void>;
  onComplete?: (transcript: TranscriptEntry[], durationSec: number) => void;
  now?: () => number;
  random?: () => number;
}

export const DISCUSSION_TIMING = {
  maxTurns: 10,
  followUpEvery: 4,
  handoffGapMs: 700,
  bidWindowMs: 1400,
  aiBidDelayMinMs: 900,
  aiBidDelaySpreadMs: 2200,
  silenceMs: 7000,
  userTurnMaxMs: 120_000,
  aiTurnMaxMs: 45_000,
};

type Timing = typeof DISCUSSION_TIMING;
const USER_ID = "user";

export class DiscussionConductor {
  readonly floor: FloorController;
  private state: ConductorState;
  private readonly listeners = new Set<() => void>();
  private readonly timing: Timing;
  private readonly now: () => number;
  private readonly random: () => number;

  /** True while the current OPEN period has been set up (bids, silence timer). */
  private windowOpen = false;
  private windowTimers: ReturnType<typeof setTimeout>[] = [];
  private grantTimer: ReturnType<typeof setTimeout> | null = null;
  private turnWatchdog: ReturnType<typeof setTimeout> | null = null;
  private turnAbort: AbortController | null = null;
  private moderatorAbort: AbortController | null = null;
  private lastFollowUpAtTurn = 0;
  /**
   * "Listening": while someone holds the floor, the panelist most likely to
   * answer them drafts its response from the live transcript. If it is granted
   * the floor next and nothing new was said, the draft is used immediately.
   */
  private prefetch: { agentId: GDAgentId; length: number; result: Promise<AgentTurnOutput>; abort: AbortController } | null = null;
  private pendingInvite = false;
  private completed = false;
  private disposed = false;
  private unsubscribeFloor: () => void;

  constructor(
    readonly topic: string,
    private readonly deps: ConductorDeps,
    timing: Partial<Timing> = {}
  ) {
    this.timing = { ...DISCUSSION_TIMING, ...timing };
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? Math.random;
    this.floor = new FloorController([USER_ID, ...GD_AGENT_IDS], this.now);
    this.state = {
      phase: "idle",
      floor: this.floor.getSnapshot(),
      transcript: [],
      moderator: { line: null, speaking: false, preparing: false },
      agents: Object.fromEntries(GD_AGENT_IDS.map((id) => [id, { activity: "idle", turns: 0, line: null, intent: null, drafting: false }])) as ConductorState["agents"],
      user: { turns: 0, turnStartedAt: null },
      notice: "Waiting to start",
      startedAt: null,
    };
    this.unsubscribeFloor = this.floor.subscribe((snapshot) => this.onFloorChange(snapshot));
  }

  // ── Store protocol ──────────────────────────────────────────────────────────

  getState = (): ConductorState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private update(patch: Partial<ConductorState> | ((s: ConductorState) => Partial<ConductorState>)) {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  private setAgent(id: GDAgentId, patch: Partial<ConductorState["agents"][GDAgentId]>) {
    this.update((s) => ({ agents: { ...s.agents, [id]: { ...s.agents[id], ...patch } } }));
  }

  private append(speakerId: string, speakerName: string, text: string) {
    const entry: TranscriptEntry = { speakerId, speakerName, text, at: this.now() };
    this.update((s) => ({ transcript: [...s.transcript, entry] }));
  }

  private nameOf(id: string): string {
    if (id === USER_ID) return "You";
    if (id === MODERATOR_ID) return GD_MODERATOR.name;
    return GD_AGENTS[id as GDAgentId]?.name ?? id;
  }

  // ── Public commands ─────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.state.phase !== "idle") return;
    this.update({ phase: "intro", startedAt: this.now(), notice: "The moderator is introducing the topic" });
    const intro = `Welcome, everyone. Today's topic is: ${this.topic} Each of you will have the floor in turn. Request it when it is open, and please don't interrupt whoever is speaking. The floor is now open.`;
    await this.moderatorSays(intro, { open: true });
    // Read through the getter: the phase may have changed while the intro played.
    if (this.disposed || this.getState().phase !== "intro") return;
    this.update({ phase: "live" });
    this.handleOpen(this.floor.getSnapshot());
  }

  /** The user asks for a turn. Only succeeds while the floor is OPEN. */
  requestFloor(): ReturnType<FloorController["requestFloor"]> {
    const result = this.floor.requestFloor(USER_ID);
    if (!result.ok && result.reason === "locked") {
      this.update({ notice: `The floor is locked while ${this.nameOf(this.state.floor.holder ?? "")} speaks` });
    }
    return result;
  }

  withdraw(): void {
    this.floor.withdraw(USER_ID);
  }

  /** The user finishes (or passes on) their turn. */
  finishUserTurn(text: string): void {
    const snap = this.floor.getSnapshot();
    if (snap.holder !== USER_ID) return;
    this.clearTurnWatchdog();
    const spoken = text.trim();
    if (spoken) this.append(USER_ID, "You", spoken);
    this.update((s) => ({ user: { turns: s.user.turns + (spoken ? 1 : 0), turnStartedAt: null } }));
    if (spoken) this.listenFor(USER_ID);
    this.floor.release(USER_ID, snap.token);
  }

  /** End the discussion early. */
  stop(): void {
    void this.wrapUp();
  }

  dispose(): void {
    this.disposed = true;
    this.prefetch?.abort.abort();
    this.prefetch = null;
    this.clearWindow();
    this.clearTurnWatchdog();
    this.turnAbort?.abort();
    this.moderatorAbort?.abort();
    this.floor.close();
    this.unsubscribeFloor();
    this.listeners.clear();
  }

  // ── Floor events ────────────────────────────────────────────────────────────

  private onFloorChange(snapshot: FloorSnapshot) {
    // Mirror floor-derived statuses into agent activity (preserving 'preparing').
    this.update((s) => {
      const agents = { ...s.agents };
      for (const id of GD_AGENT_IDS) {
        const status = this.floor.statusOf(id);
        const current = agents[id].activity;
        const activity: AgentActivity = status === "speaking" ? (current === "preparing" ? "preparing" : "speaking") : status;
        agents[id] = { ...agents[id], activity };
      }
      return { floor: snapshot, agents };
    });

    if (snapshot.state !== "OPEN") {
      this.clearWindow();
      this.windowOpen = false;
      return;
    }
    if (this.state.phase === "live") this.handleOpen(snapshot);
  }

  private handleOpen(snapshot: FloorSnapshot) {
    if (this.disposed || this.state.phase !== "live" || snapshot.state !== "OPEN" || this.pendingInvite) return;

    const newWindow = !this.windowOpen;
    if (newWindow) {
      this.clearWindow();
      this.windowOpen = true;

      if (snapshot.turns >= this.timing.maxTurns) {
        void this.wrapUp();
        return;
      }
      if (snapshot.turns > 0 && snapshot.turns % this.timing.followUpEvery === 0 && this.lastFollowUpAtTurn !== snapshot.turns) {
        this.lastFollowUpAtTurn = snapshot.turns;
        void this.moderatorFollowUp();
        return;
      }

      this.update({ notice: snapshot.queue.length ? `Handing the floor to ${this.nameOf(snapshot.queue[0])}` : "The floor is open" });
      if (snapshot.queue.length === 0) this.scheduleAgentBids();
      this.windowTimers.push(setTimeout(() => this.onSilence(), this.timing.silenceMs));
    }

    // Grant once someone is queued: immediately-ish for an existing queue
    // (sequential hand-off), after a bidding window for fresh requests.
    if (snapshot.queue.length > 0 && !this.grantTimer) {
      const delay = newWindow ? this.timing.handoffGapMs : this.timing.bidWindowMs;
      this.grantTimer = setTimeout(() => {
        this.grantTimer = null;
        const grant = this.floor.grantNext();
        if (grant) void this.runTurn(grant.id, grant.token);
      }, delay);
    }
  }

  private scheduleAgentBids() {
    const { agents, transcript } = this.state;
    const lastSpeaker = [...transcript].reverse().find((t) => t.speakerId !== MODERATOR_ID)?.speakerId;
    for (const id of GD_AGENT_IDS) {
      const agent = GD_AGENTS[id];
      const turns = agents[id].turns;
      let p = agent.eagerness * Math.max(0.25, 1 - turns * 0.2);
      if (turns === 0) p += 0.2;
      if (lastSpeaker === id) p *= 0.2;
      // The panelist who has been preparing a response is keen to give it.
      if (this.prefetch?.agentId === id) p = Math.max(p, 0.85);
      if (this.random() >= Math.min(0.9, Math.max(0.05, p))) continue;
      const delay = this.timing.aiBidDelayMinMs + this.random() * this.timing.aiBidDelaySpreadMs;
      this.windowTimers.push(
        setTimeout(() => {
          // Agents only raise a hand while the floor is open and the queue is short.
          const snap = this.floor.getSnapshot();
          if (snap.state === "OPEN" && snap.queue.length < 2) this.floor.requestFloor(id);
        }, delay)
      );
    }
  }

  private onSilence() {
    const snap = this.floor.getSnapshot();
    if (snap.state !== "OPEN" || snap.queue.length > 0 || this.state.phase !== "live") return;
    const { agents, user } = this.state;
    // Invite the user if they haven't contributed yet; otherwise the quietest agent.
    const quietAgent = [...GD_AGENT_IDS].sort((a, b) => agents[a].turns - agents[b].turns)[0];
    const target = user.turns === 0 && snap.turns >= 2 ? USER_ID : quietAgent;
    void this.moderatorInvite(target);
  }

  // ── Turns ───────────────────────────────────────────────────────────────────

  private async runTurn(id: string, token: number) {
    if (id === USER_ID) {
      this.update({ user: { ...this.state.user, turnStartedAt: this.now() }, notice: "You have the floor" });
      this.turnWatchdog = setTimeout(() => {
        // Time limit: end the user's turn without recording a contribution here;
        // the UI flushes its draft through finishUserTurn when it sees the release.
        if (this.floor.holds(USER_ID, token)) this.floor.forceRelease();
        this.update({ user: { ...this.state.user, turnStartedAt: null }, notice: "Your time is up — the floor has moved on" });
      }, this.timing.userTurnMaxMs);
      return;
    }

    const agentId = id as GDAgentId;
    const abort = new AbortController();
    this.turnAbort = abort;
    this.turnWatchdog = setTimeout(() => {
      abort.abort();
      if (this.floor.holds(agentId, token)) this.floor.forceRelease();
    }, this.timing.aiTurnMaxMs);

    this.setAgent(agentId, { activity: "preparing" });
    this.update({ notice: `${this.nameOf(agentId)} has the floor` });

    let text: string;
    let intent: string | null = null;
    try {
      const pre = this.prefetch;
      this.prefetch = null;
      const output =
        pre && pre.agentId === agentId && pre.length === this.state.transcript.length
          ? await pre.result
          : (pre?.abort.abort(), await this.deps.agentTurn(agentId, this.state.transcript, abort.signal));
      if (pre) this.setAgent(pre.agentId, { drafting: false });
      text = typeof output === "string" ? output : output.text;
      if (typeof output !== "string" && output.respondingTo) {
        const who = output.respondingTo === "you" ? "you" : output.respondingTo;
        intent = output.move === "rebut" ? `Challenging ${who}` : output.move === "bridge" ? "Finding common ground" : output.move === "build" ? `Building on ${who}` : null;
      }
    } catch {
      text = "";
    }
    // The lock may have been revoked (watchdog, wrap-up) while we waited.
    if (!this.floor.holds(agentId, token) || abort.signal.aborted) {
      this.setAgent(agentId, { activity: this.floor.statusOf(agentId), line: null });
      return;
    }
    if (!text.trim()) {
      this.clearTurnWatchdog();
      this.setAgent(agentId, { activity: "idle", line: null });
      this.floor.release(agentId, token);
      return;
    }

    this.append(agentId, this.nameOf(agentId), text);
    this.setAgent(agentId, { activity: "speaking", line: text, intent });
    // While this agent speaks, the natural responder listens and drafts a reply.
    this.listenFor(agentId);
    await this.deps.speak(text, agentId, abort.signal);

    this.clearTurnWatchdog();
    this.setAgent(agentId, { line: null, intent: null, turns: this.state.agents[agentId].turns + 1 });
    if (this.floor.holds(agentId, token)) this.floor.release(agentId, token);
    this.setAgent(agentId, { activity: this.floor.statusOf(agentId) });
  }

  /** Start the natural responder drafting a reply to what `speakerId` just said. */
  private listenFor(speakerId: string) {
    if (this.disposed || this.closing) return;
    const responder = naturalResponder(speakerId);
    if (responder === speakerId) return;
    this.prefetch?.abort.abort();
    if (this.prefetch) this.setAgent(this.prefetch.agentId, { drafting: false });
    const abort = new AbortController();
    const length = this.state.transcript.length;
    const result = this.deps.agentTurn(responder, this.state.transcript, abort.signal).catch(() => "" as AgentTurnOutput);
    this.prefetch = { agentId: responder, length, result, abort };
    this.setAgent(responder, { drafting: true });
    void result.then(() => {
      if (this.prefetch?.result === result && !this.disposed) this.setAgent(responder, { drafting: false });
    });
  }

  // ── Moderator ───────────────────────────────────────────────────────────────

  private get closing(): boolean {
    return this.state.phase === "wrapping" || this.state.phase === "ended";
  }

  private async moderatorSays(text: string, opts: { open: boolean; force?: boolean }): Promise<boolean> {
    const token = this.floor.moderatorTakeFloor();
    // `force` is for the closing line, which must be heard even if the moderator already holds the floor.
    if (token === null && !opts.force) return false;
    const abort = new AbortController();
    this.moderatorAbort = abort;
    this.append(MODERATOR_ID, GD_MODERATOR.name, text);
    this.update({ moderator: { line: text, speaking: true, preparing: false } });
    await this.deps.speak(text, MODERATOR_ID, abort.signal);
    this.update((s) => ({ moderator: { ...s.moderator, speaking: false } }));
    if (opts.open && token !== null && !this.disposed && !this.closing) this.floor.moderatorOpenFloor(token);
    return true;
  }

  private async moderatorFollowUp() {
    const token = this.floor.moderatorTakeFloor();
    if (token === null) return;
    const abort = new AbortController();
    this.moderatorAbort = abort;
    this.update({ moderator: { line: null, speaking: false, preparing: true }, notice: "The moderator is asking a follow-up question" });
    let text: string;
    try {
      text = await this.deps.followUp(this.state.transcript, abort.signal);
    } catch {
      text = "Let's go deeper. What would have to be true for the opposite position to be correct?";
    }
    if (this.disposed || this.closing || !this.floor.holds(MODERATOR_ID, token)) return;
    this.append(MODERATOR_ID, GD_MODERATOR.name, text);
    this.update({ moderator: { line: text, speaking: true, preparing: false } });
    await this.deps.speak(text, MODERATOR_ID, abort.signal);
    this.update((s) => ({ moderator: { ...s.moderator, speaking: false } }));
    if (!this.disposed && !this.closing) this.floor.moderatorOpenFloor(token);
  }

  private async moderatorInvite(target: string) {
    const line =
      target === USER_ID
        ? "I'd like to bring you in. What is your view on this?"
        : `${this.nameOf(target).split(" ")[0]}, we haven't heard much from you yet. What's your view?`;
    // Suppress normal bidding while the invited participant takes the floor.
    this.pendingInvite = true;
    const spoke = await this.moderatorSays(line, { open: true });
    this.pendingInvite = false;
    if (!spoke || this.disposed || this.state.phase !== "live") return;
    const grant = this.floor.invite(target);
    if (grant) void this.runTurn(grant.id, grant.token);
    else this.handleOpen(this.floor.getSnapshot());
  }

  private async wrapUp() {
    if (this.state.phase === "wrapping" || this.state.phase === "ended" || this.disposed) return;
    this.update({ phase: "wrapping", notice: "The moderator is closing the discussion" });
    this.clearWindow();
    this.clearTurnWatchdog();
    this.turnAbort?.abort();
    this.moderatorAbort?.abort();
    if (this.floor.getSnapshot().state === "LOCKED") this.floor.forceRelease();
    this.update((s) => ({
      agents: Object.fromEntries(GD_AGENT_IDS.map((id) => [id, { ...s.agents[id], activity: "idle", line: null, intent: null, drafting: false }])) as ConductorState["agents"],
    }));

    await this.moderatorSays(
      "Thank you, everyone. That brings our discussion to a close. The panel will now review each contribution.",
      { open: false, force: true }
    );
    this.floor.close();
    this.update({ phase: "ended", notice: "Discussion complete" });
    if (!this.completed) {
      this.completed = true;
      const duration = Math.round((this.now() - (this.state.startedAt ?? this.now())) / 1000);
      this.deps.onComplete?.(this.state.transcript, duration);
    }
  }

  // ── Timers ──────────────────────────────────────────────────────────────────

  private clearWindow() {
    for (const t of this.windowTimers) clearTimeout(t);
    this.windowTimers = [];
    if (this.grantTimer) clearTimeout(this.grantTimer);
    this.grantTimer = null;
  }

  private clearTurnWatchdog() {
    if (this.turnWatchdog) clearTimeout(this.turnWatchdog);
    this.turnWatchdog = null;
  }
}
