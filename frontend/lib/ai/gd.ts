import "server-only";

import { z } from "zod";
import type { TargetRole } from "@/lib/domain";
import type { GDEvaluation } from "@/lib/db";
import type { GDTranscriptEntry } from "@/lib/validation";
import { AIUnavailableError, generateJson, generateText, toSpokenText } from "@/lib/ai/gemini";
import type { GDAgentId } from "@/lib/gd/agents";
import { TOPIC_PACKS, type TopicPack } from "@/lib/gd/topic-packs";

/**
 * Group discussion voices.
 *
 * Panelists should sound like people in a room, not a model reading an essay:
 * short sentences, everyday words, one idea per turn, reacting to the last
 * speaker by name — and always about the topic and the moderator's current
 * question. With Gemini the prompt enforces that (and off-topic replies are
 * rejected); offline, lines are built from hand-written topic packs.
 */

// ─── Topics ───────────────────────────────────────────────────────────────────

export function pickTopic(role: TargetRole | null, exclude?: string): string {
  const pool = TOPIC_PACKS.filter((t) => (!t.roles || (role && t.roles.includes(role))) && t.text !== exclude);
  // Prefer track-specific topics roughly half the time.
  const specific = pool.filter((t) => t.roles);
  const source = specific.length && Math.random() < 0.5 ? specific : pool;
  return source[Math.floor(Math.random() * source.length)].text;
}

export function packFor(topic: string): TopicPack | undefined {
  return TOPIC_PACKS.find((t) => t.text === topic);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function historyText(history: GDTranscriptEntry[]): string {
  return history.length ? history.slice(-10).map((h) => `${h.speakerName}: ${h.text}`).join("\n") : "(No one has spoken yet.)";
}

export function firstName(entry: GDTranscriptEntry): string {
  return entry.speakerId === "user" ? "you" : entry.speakerName.split(" ")[0];
}

const STOP = new Set(
  "about above after again against because been before being below between both could does doing down during each every from further have having here itself just more most other ought ourselves over same should some such than that their theirs them themselves then there these they this those through under until very were what when where which while whom will with would your yours yourself really think people thing things going actually maybe also into make like know".split(" ")
);

export function contentWords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)));
}

/** True when a line shares vocabulary with the topic or the recent discussion. */
export function onTopic(line: string, topic: string, history: GDTranscriptEntry[], minShared = 2): boolean {
  const words = contentWords(line);
  const context = contentWords(`${topic} ${history.slice(-6).map((h) => h.text).join(" ")}`);
  let shared = 0;
  for (const w of words) if (context.has(w) || context.has(w.replace(/s$/, ""))) shared++;
  return shared >= minShared;
}

export function lastModeratorQuestion(history: GDTranscriptEntry[]): string | null {
  return [...history].reverse().find((h) => h.speakerId === "moderator")?.text ?? null;
}

// ─── Offline panelists ────────────────────────────────────────────────────────

const pick = <T,>(xs: T[], seed: number): T => xs[Math.abs(seed) % xs.length];
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function unused(lines: string[], history: GDTranscriptEntry[]): string[] {
  const said = history.map((h) => h.text).join(" \n ");
  const fresh = lines.filter((l) => !said.includes(l));
  return fresh.length ? fresh : lines;
}

/** Which side of the motion a line argues, judged against the pack. */
export function sideOf(text: string, pack: TopicPack): "pro" | "con" | "unknown" {
  if (pack.pro.some((l) => text.includes(l))) return "pro";
  if (pack.con.some((l) => text.includes(l))) return "con";
  const t = text.toLowerCase();
  const against = /\b(disagree|against|risk|problem|danger|slow|cost|worse|shouldn'?t|not\s+(a\s+)?good|bad idea|hurt)\b/.test(t);
  const support = /\b(agree|support|benefit|better|should|good idea|helps?|valuable|important)\b/.test(t);
  if (against && !support) return "con";
  if (support && !against) return "pro";
  return "unknown";
}

export function offlineLine(topic: string, agentId: GDAgentId, history: GDTranscriptEntry[]): string {
  const pack = packFor(topic) ?? TOPIC_PACKS[0];
  const seed = history.length + agentId.charCodeAt(2);
  const previous = [...history].reverse().find((h) => h.speakerId !== agentId && h.speakerId !== "moderator");
  const prevName = previous ? firstName(previous) : null;
  const lastSpeaker = history.at(-1);
  const answeringModerator = lastSpeaker?.speakerId === "moderator" && history.filter((h) => h.speakerId === "moderator").length > 1;
  const myTurns = history.filter((h) => h.speakerId === agentId).length;
  const prevSide = previous ? sideOf(previous.text, pack) : "unknown";

  const lead = answeringModerator ? pick(["On that question, ", "To answer that, ", "Good question. "], seed) : "";

  switch (agentId) {
    // The Optimist: argues for the motion; answers risks with how to manage them.
    case "ai1": {
      const point = pick(unused(pack.pro, history), seed);
      const opener = !prevName
        ? pick([`I'm optimistic about ${pack.short}, and here's why.`, "Let me start with the upside, because it's real."], seed)
        : prevSide === "con"
          ? pick([`I hear the concern, ${prevName === "you" ? "and it's fair" : prevName}, but I think the upside is bigger.`, `Those risks are manageable, ${prevName === "you" ? "honestly" : prevName}.`], seed)
          : pick([`I want to build on what ${prevName === "you" ? "you" : prevName} said.`, `Exactly, and it goes further than that.`], seed);
      return `${lead}${opener} ${point}`;
    }
    // Pragmatic: what actually happens in real teams.
    case "ai2": {
      const side = prevSide === "con" ? pack.con : prevSide === "pro" ? pack.pro : myTurns % 2 === 0 ? pack.con : pack.pro;
      const point = pick(unused(side, history), seed);
      const opener = prevName
        ? pick([`Yeah, I agree with ${prevName} on that.`, `I mean, ${prevName} is right in theory.`, `That's true, ${prevName}.`], seed)
        : "Speaking practically,";
      return `${lead}${opener} In practice, ${lowerFirst(point)}`;
    }
    // The Skeptic: argues against the motion; stress-tests the last claim.
    case "ai3": {
      const point = pick(unused(pack.con, history), seed);
      const opener = prevName
        ? prevSide === "con"
          ? pick([`${capital(prevName === "you" ? "you're" : `${prevName}'s`)} right to worry, and there's another problem.`, "And it gets harder at scale."], seed)
          : pick(
              [
                `I see where ${prevName === "you" ? "you're" : `${prevName}'s`} coming from, but what happens at scale?`,
                `Hmm, I'm not convinced yet, ${prevName === "you" ? "honestly" : prevName}. Think about the edge cases.`,
                "Let me stress-test that for a second.",
              ],
              seed
            )
        : "I'll be the skeptic here.";
      return `${lead}${opener} ${point}`;
    }
    // Synthesizer: names the disagreement, proposes a middle ground.
    case "ai4":
    default: {
      const speakers = [...new Set(history.filter((h) => h.speakerId !== "moderator" && h.speakerId !== agentId).slice(-4).map(firstName))];
      const middle = pick(unused(pack.middle, history), seed);
      const summary =
        speakers.length >= 2
          ? `So far ${listNames(speakers.slice(0, 3))} have raised good points on both sides.`
          : `We clearly see both sides of ${pack.short}.`;
      return `${lead}${pick(["Can I try to pull this together?", "Okay, let me connect a few things."], seed)} ${summary} ${middle}`;
    }
  }
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listNames(names: string[]): string {
  const display = names.map((n) => (n === "you" ? "you" : n));
  if (display.length <= 1) return display.join("");
  return `${display.slice(0, -1).join(", ")} and ${display.at(-1)}`;
}

// ─── Moderator follow-ups ─────────────────────────────────────────────────────

const FOLLOW_UPS = [
  "Let's go a bit deeper. What would have to be true for the other side to be right?",
  "Good points so far. How should a company actually decide this? What matters most?",
  "Let's think about people. Who takes the risk here, and who gets the benefit?",
  "Looking five years ahead, does anyone's position change?",
  "Can someone suggest a concrete approach that answers the biggest concern so far?",
];

export async function moderatorFollowUp(topic: string, history: GDTranscriptEntry[]): Promise<string> {
  const asked = history.filter((h) => h.speakerId === "moderator").length;
  try {
    const text = await generateText({
      system: "You are a calm, neutral group discussion moderator. You speak simply and briefly.",
      prompt: `Topic: "${topic}"\n\nDiscussion so far:\n${historyText(history)}\n\nAsk exactly one short follow-up question (one or two plain sentences, under 30 words) about THIS topic that opens an angle the group hasn't covered. No quotation marks.`,
      temperature: 0.7,
      maxOutputTokens: 120,
      timeoutMs: 10_000,
    });
    const spoken = toSpokenText(text, 260);
    if (onTopic(spoken, topic, history, 1)) return spoken;
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
  }
  return FOLLOW_UPS[asked % FOLLOW_UPS.length];
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

const gdEvaluationSchema = z.object({
  summary: z.string().min(1).max(1000),
  dimensions: z.object({
    clarity: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    collaboration: z.number().min(0).max(100),
    initiative: z.number().min(0).max(100),
  }),
  strengths: z.array(z.string().max(300)).min(1).max(3),
  improvements: z.array(z.string().max(300)).min(1).max(3),
});

function scoreFromDimensions(d: GDEvaluation["dimensions"]): number {
  return Math.round(d.clarity * 0.3 + d.relevance * 0.3 + d.collaboration * 0.2 + d.initiative * 0.2);
}

export async function evaluateDiscussion(topic: string, transcript: GDTranscriptEntry[]): Promise<GDEvaluation> {
  const mine = transcript.filter((t) => t.speakerId === "user");
  if (!mine.length) {
    return {
      score: 20,
      summary: "You did not take the floor during this discussion, so there is little evidence to assess. In real group discussions, silence is usually scored as low initiative.",
      dimensions: { clarity: 20, relevance: 20, collaboration: 25, initiative: 10 },
      strengths: ["You stayed present for the full discussion."],
      improvements: [
        "Claim the floor within the first few turns — an early, structured contribution sets your position.",
        "Aim for three or more contributions that build on what others said.",
      ],
      source: "heuristic",
    };
  }

  try {
    const result = await generateJson(gdEvaluationSchema, {
      system: "You are an assessor scoring a candidate (speaker 'You') in a professional group discussion. Be specific and fair.",
      prompt: `Topic: "${topic}"\n\nFull transcript:\n${transcript.map((t) => `${t.speakerName}: ${t.text}`).join("\n")}\n\nScore only the candidate labelled "You". Return JSON: "summary" (2-3 sentences), "dimensions" with clarity, relevance, collaboration (building on others), initiative (0-100 each), "strengths" (2 items quoting or referencing their contributions), "improvements" (2 items).`,
      temperature: 0.3,
      maxOutputTokens: 1200,
      timeoutMs: 25_000,
    });
    const dimensions = {
      clarity: Math.round(result.dimensions.clarity),
      relevance: Math.round(result.dimensions.relevance),
      collaboration: Math.round(result.dimensions.collaboration),
      initiative: Math.round(result.dimensions.initiative),
    };
    return { ...result, dimensions, score: scoreFromDimensions(dimensions), source: "model" };
  } catch (error) {
    if (!(error instanceof AIUnavailableError)) throw error;
    return heuristicDiscussionScore(topic, transcript, mine);
  }
}

function heuristicDiscussionScore(topic: string, transcript: GDTranscriptEntry[], mine: GDTranscriptEntry[]): GDEvaluation {
  const words = mine.map((m) => m.text.split(/\s+/).filter(Boolean).length);
  const avgWords = words.reduce((a, b) => a + b, 0) / mine.length;
  const topicTerms = new Set(topic.toLowerCase().match(/[a-z]{5,}/g) ?? []);
  const relevantHits = mine.filter((m) => (m.text.toLowerCase().match(/[a-z]{5,}/g) ?? []).some((w) => topicTerms.has(w))).length;
  const buildsOnOthers = mine.filter((m) => /\b(building on|agree with|disagree with|as \w+ said|to add to|you mentioned|point about)\b/i.test(m.text)).length;
  const structured = mine.filter((m) => /\b(first|second|because|for example|for instance|therefore|in summary)\b/i.test(m.text)).length;
  const firstUserIndex = transcript.findIndex((t) => t.speakerId === "user");
  const participants = transcript.filter((t) => t.speakerId !== "moderator").length;

  const clarity = Math.min(95, 35 + Math.min(1, avgWords / 60) * 35 + (structured / mine.length) * 25);
  const relevance = Math.min(95, 40 + (relevantHits / mine.length) * 50);
  const collaboration = Math.min(95, 35 + (buildsOnOthers / mine.length) * 55);
  const initiative = Math.min(
    95,
    25 + Math.min(1, mine.length / 3) * 45 + (firstUserIndex >= 0 && firstUserIndex <= 3 ? 20 : 0) + Math.min(10, (mine.length / Math.max(1, participants)) * 40)
  );
  const dimensions = {
    clarity: Math.round(clarity),
    relevance: Math.round(relevance),
    collaboration: Math.round(collaboration),
    initiative: Math.round(initiative),
  };

  const improvements: string[] = [];
  if (mine.length < 3) improvements.push("Take the floor at least three times; consistent presence matters as much as any single point.");
  if (buildsOnOthers / mine.length < 0.5) improvements.push("Reference other speakers by name and build on or challenge their points directly.");
  if (avgWords < 40) improvements.push("Develop each point with a reason and an example rather than a one-line opinion.");
  if (structured / mine.length < 0.5) improvements.push("Signpost your reasoning (because, for example, in summary) so assessors can follow it.");

  // Panels weigh presence heavily: a single strong point can't be "interview ready".
  const participationCap = mine.length >= 3 ? 100 : 56 + mine.length * 8;

  return {
    score: Math.min(scoreFromDimensions(dimensions), participationCap),
    summary: `You contributed ${mine.length} time${mine.length === 1 ? "" : "s"}, averaging ${Math.round(avgWords)} words per turn. Scored with the offline rubric — connect Gemini for transcript-level assessment.`,
    dimensions,
    strengths: [
      firstUserIndex >= 0 && firstUserIndex <= 3 ? "You entered the discussion early, which signals initiative." : "You contributed to the discussion when you held the floor.",
      buildsOnOthers > 0 ? "You engaged directly with other participants' arguments." : "You kept your contributions on topic.",
    ],
    improvements: improvements.length ? improvements.slice(0, 3) : ["Close a contribution with a crisp summary to help steer the group."],
    source: "heuristic",
  };
}
