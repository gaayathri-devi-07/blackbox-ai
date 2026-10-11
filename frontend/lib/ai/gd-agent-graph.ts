import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { AIUnavailableError, generateText, toSpokenText } from "@/lib/ai/gemini";
import { contentWords, firstName, historyText, lastModeratorQuestion, offlineLine, onTopic, packFor, sideOf, unused } from "@/lib/ai/gd";
import { createVault, maskPii, unmaskPii } from "@/lib/governance/pii";
import { traced } from "@/lib/observability/tracing";
import { GD_AGENTS, type GDAgentId, type GDStance } from "@/lib/gd/agents";
import { TOPIC_PACKS } from "@/lib/gd/topic-packs";
import type { GDTranscriptEntry } from "@/lib/validation";

/**
 * One panelist turn as a LangGraph state machine.
 *
 *   START → listen → gather → compose → review ─┬─ accept → END
 *                                 ▲             ├─ retry (with the reviewer's notes) → compose
 *                               └─────────────┘
 *                                             └─ fallback → END (offline, stance-aware line)
 *
 * listen  reads the active speaker's latest contribution and decides the move
 *         from this agent's stance: rebut it, build on it, or open the debate.
 * gather  picks talking points for the agent's side that nobody has used yet.
 * compose asks Gemini for a short spoken contribution aimed at that speaker.
 * review  checks it is on topic, short, new, and actually responds to the
 *         speaker; one retry with feedback, otherwise the offline line.
 *
 * The floor-control state machine (OPEN → LOCKED → release, WAITING for
 * everyone else) runs in the room's conductor; this graph only runs while the
 * agent holds the lock. Transcript text is PII-masked before it enters the
 * graph, so LangGraph/LangSmith traces never contain personal data.
 */

export type GDMove = "rebut" | "build" | "bridge" | "open";

interface Analysis {
  speakerId: string | null;
  speakerName: string | null;
  claim: string | null;
  claimSide: "pro" | "con" | "unknown";
  move: GDMove;
  moderatorQuestion: string | null;
}

const GDTurnState = Annotation.Root({
  topic: Annotation<string>,
  agentId: Annotation<GDAgentId>,
  history: Annotation<GDTranscriptEntry[]>,
  analysis: Annotation<Analysis | null>,
  talkingPoints: Annotation<string[]>,
  draft: Annotation<string>,
  attempts: Annotation<number>,
  issues: Annotation<string[]>,
  verdict: Annotation<"accept" | "retry" | "fallback" | null>,
  text: Annotation<string>,
  source: Annotation<"model" | "fallback">,
});
type TurnState = typeof GDTurnState.State;

function moveFor(stance: GDStance, side: "pro" | "con" | "unknown", hasSpeaker: boolean): GDMove {
  if (!hasSpeaker) return "open";
  if (stance === "synthesizer") return "bridge";
  // The Optimist and the Skeptic agree only with their own side; anything else is challenged.
  if (stance === "optimist") return side === "pro" ? "build" : "rebut";
  if (stance === "skeptic") return side === "con" ? "build" : "rebut";
  // Pragmatist: tests confident claims either way against feasibility.
  return side === "unknown" ? "build" : "rebut";
}

/** Side of a claim: from the speaker's fixed stance when it is a panelist, else from the words. */
function claimSideOf(speakerId: string, text: string, topic: string): "pro" | "con" | "unknown" {
  const stance = GD_AGENTS[speakerId as GDAgentId]?.stance;
  if (stance === "optimist") return "pro";
  if (stance === "skeptic") return "con";
  return sideOf(text, packFor(topic) ?? TOPIC_PACKS[0]);
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

function listen(state: TurnState): Partial<TurnState> {
  const agent = GD_AGENTS[state.agentId];
  // The active (most recent) speaker other than this agent and the moderator.
  const last = [...state.history].reverse().find((h) => h.speakerId !== state.agentId && h.speakerId !== "moderator");
  const claim = last ? last.text.split(/(?<=[.!?])\s+/).slice(-2).join(" ") : null;
  const claimSide = last ? claimSideOf(last.speakerId, last.text, state.topic) : "unknown";
  return {
    analysis: {
      speakerId: last?.speakerId ?? null,
      speakerName: last ? firstName(last) : null,
      claim,
      claimSide,
      move: moveFor(agent.stance, claimSide, Boolean(last)),
      moderatorQuestion: lastModeratorQuestion(state.history),
    },
  };
}

function gather(state: TurnState): Partial<TurnState> {
  const agent = GD_AGENTS[state.agentId];
  const pack = packFor(state.topic) ?? TOPIC_PACKS[0];
  const side = agent.stance === "optimist" ? pack.pro : agent.stance === "skeptic" ? pack.con : agent.stance === "synthesizer" ? pack.middle : [...pack.con, ...pack.middle];
  return { talkingPoints: unused(side, state.history).slice(0, 3) };
}

const MOVE_TEXT: Record<GDMove, (name: string) => string> = {
  rebut: (n) => `Your FIRST sentence must react to ${n}'s point, addressed to ${n}. Politely disagree with their specific claim and give your reason.`,
  build: (n) => `Your FIRST sentence must react to ${n}'s point, addressed to ${n}. Agree with their specific point and add something new to it.`,
  bridge: (n) => `Connect ${n}'s point with an earlier opposing view by name and propose a practical middle ground.`,
  open: () => "You are the first to speak: state your position simply with one reason.",
};

async function draft(state: TurnState): Promise<Partial<TurnState>> {
  const agent = GD_AGENTS[state.agentId];
  const a = state.analysis!;
  const name = a.speakerName === "you" ? 'the candidate (address them as "you")' : (a.speakerName ?? "the group");
  try {
    const raw = await generateText({
      system: [
        `You are ${agent.name}, "${agent.label}", a participant in a group discussion during a job selection process. ${agent.persona}`,
        `You always look at: ${agent.focus}.`,
        'Talk like a real person in a room: simple everyday words, short sentences (mostly under 15 words), contractions, at most one natural filler such as "honestly". No lists, markdown or quotation marks. No jargon unless explained.',
      ].join("\n"),
      prompt: [
        `Topic: "${state.topic}"`,
        a.moderatorQuestion ? `The moderator's latest question: "${a.moderatorQuestion}"` : "",
        `Discussion so far:\n${historyText(state.history)}`,
        a.claim ? `The active speaker (${a.speakerName}) just said: "${a.claim}"` : "",
        "",
        `You have the floor. ${MOVE_TEXT[a.move](name)}`,
        state.talkingPoints.length ? `Ideas you could use (rephrase, don't copy): ${state.talkingPoints.join(" | ")}` : "",
        "Say 2 or 3 short sentences, at most 55 words, making ONE clear point. Do not repeat a point someone already made. Stay strictly on the topic.",
        state.issues.length ? `A reviewer rejected your last attempt because: ${state.issues.join("; ")}. Fix that.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      temperature: 0.85,
      maxOutputTokens: 900,
      timeoutMs: 12_000,
      feature: "gd.agent",
    });
    return { draft: toSpokenText(raw, 420), attempts: state.attempts + 1, source: "model" };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    return { draft: "", attempts: state.attempts + 1, source: "fallback" };
  }
}

function review(state: TurnState): Partial<TurnState> {
  if (state.source === "fallback" || !state.draft) return { verdict: "fallback" };
  const a = state.analysis!;
  const issues: string[] = [];
  const text = state.draft;
  const words = text.split(/\s+/).length;
  if (words > 75) issues.push(`it was ${words} words; keep it under 55`);
  if (!onTopic(text, state.topic, state.history)) issues.push("it drifted off the topic");
  const mine = contentWords(text);
  const repeats = state.history.some((h) => {
    const other = contentWords(h.text);
    const overlap = [...mine].filter((w) => other.has(w)).length;
    return mine.size > 0 && overlap / mine.size > 0.6;
  });
  if (repeats) issues.push("it repeated a point already made");
  if ((a.move === "rebut" || a.move === "build") && a.speakerName) {
    const target = a.speakerName === "you" ? /\byou\b/i : new RegExp(`\\b${a.speakerName}\\b`, "i");
    if (!target.test(text)) issues.push(`it didn't respond to ${a.speakerName} by name`);
    // It must engage with what was actually said, not just name the speaker.
    const claimWords = contentWords(a.claim ?? "");
    if (claimWords.size >= 3 && ![...mine].some((w) => claimWords.has(w) || claimWords.has(w.replace(/s$/, "")))) {
      issues.push(`it didn't address ${a.speakerName}'s actual point ("${(a.claim ?? "").slice(0, 120)}")`);
    }
  }
  if (!issues.length) return { verdict: "accept", text, issues: [] };
  return { verdict: state.attempts < 2 ? "retry" : "fallback", issues };
}

function fallback(state: TurnState): Partial<TurnState> {
  return { text: offlineLine(state.topic, state.agentId, state.history), source: "fallback" };
}

const graph = new StateGraph(GDTurnState)
  .addNode("listen", listen)
  .addNode("gather", gather)
  .addNode("compose", draft)
  .addNode("review", review)
  .addNode("fallback", fallback)
  .addEdge(START, "listen")
  .addEdge("listen", "gather")
  .addEdge("gather", "compose")
  .addEdge("compose", "review")
  .addConditionalEdges("review", (s: TurnState) => (s.verdict === "accept" ? END : s.verdict === "retry" ? "compose" : "fallback"), {
    [END]: END,
    compose: "compose",
    fallback: "fallback",
  })
  .addEdge("fallback", END)
  .compile();

export interface AgentTurnResult {
  text: string;
  source: "model" | "fallback";
  move: GDMove;
  /** First name of the speaker this turn responds to ("you" for the candidate). */
  respondingTo: string | null;
}

/** Run one panelist turn through the graph. */
export async function runAgentTurn(topic: string, agentId: GDAgentId, history: GDTranscriptEntry[]): Promise<AgentTurnResult> {
  // Mask the transcript before it enters the graph (and any LangGraph trace).
  const vault = createVault();
  const masked = history.map((h) => ({ ...h, text: maskPii(h.text, { vault, skip: ["NAME"] }).text }));
  const result = await traced("gd.agent_graph", "chain", { topic, agentId, turns: masked.length }, () =>
    graph.invoke(
      {
        topic,
        agentId,
        history: masked,
        analysis: null,
        talkingPoints: [],
        draft: "",
        attempts: 0,
        issues: [],
        verdict: null,
        text: "",
        source: "model",
      },
      { recursionLimit: 12, runName: `gd_turn_${GD_AGENTS[agentId].stance}` }
    )
  );
  return {
    text: unmaskPii(result.text, vault),
    source: result.source,
    move: result.analysis?.move ?? "open",
    respondingTo: result.analysis?.speakerName ?? null,
  };
}
