/**
 * Expressive delivery for interviewer, moderator and panelist voices.
 *
 * A line of text gets an emotion (from the conversational move and its words),
 * then a delivery plan:
 *   - Gemini TTS receives a short director's note (emotion, pace, where to pause)
 *     plus the text with natural breath marks, so it performs rather than reads.
 *   - The browser voice is driven phrase by phrase: discourse markers ("Okay,"
 *     "So,") become their own beats, there is a thinking pause before the
 *     question, and pitch and rate shift with the emotion.
 */

export type Emotion = "warm" | "curious" | "encouraging" | "empathetic" | "thoughtful" | "serious" | "upbeat" | "neutral";

export type SpeakerRole = "interviewer" | "moderator" | "panelist";

export interface DeliveryHint {
  /** The conversational move, when known (interview turn kind, GD action). */
  move?: "opening" | "question" | "followup" | "coaching" | "closing" | "rebuttal" | "summary";
  /** Interview mode: supportive interviews sound warmer, pressure rounds crisper. */
  mode?: "SUPPORTIVE" | "STANDARD" | "PRESSURE";
  role?: SpeakerRole;
  /** Name and one-line personality for the director's note. */
  persona?: { name?: string; trait?: string };
}

const PRAISE = /\b(great|good|nice|well done|excellent|love that|that's (a )?(solid|strong|clear)|exactly|spot on|impressive)\b/i;
const EMPATHY = /\b(no worries|that's (okay|ok|fine|alright)|don't worry|happens to everyone|take your time|it's (okay|fine)|that's a tough one|totally fair)\b/i;
const CHALLENGE = /\b(but why|are you sure|what if|convince me|walk me through why|that wouldn't|i'm not sure that|push back|disagree)\b/i;
const WELCOME = /\b(welcome|hello|hi|nice to meet|thanks for joining|let's get started|good (morning|afternoon|evening))\b/i;
const CLOSING = /\b(that's all|we're done|thank you for your time|that wraps|end of (the|our) (session|interview)|good luck)\b/i;

export function inferEmotion(text: string, hint: DeliveryHint = {}): Emotion {
  if (hint.move === "coaching" || EMPATHY.test(text)) return "empathetic";
  if (hint.move === "opening" || WELCOME.test(text)) return hint.mode === "PRESSURE" ? "neutral" : "warm";
  if (hint.move === "closing" || CLOSING.test(text)) return "upbeat";
  if (hint.move === "rebuttal" || CHALLENGE.test(text)) return hint.mode === "SUPPORTIVE" ? "curious" : "serious";
  if (hint.move === "summary") return "thoughtful";
  if (hint.move === "followup") return "curious";
  if (PRAISE.test(text)) return "encouraging";
  if (hint.mode === "PRESSURE") return "serious";
  if (hint.mode === "SUPPORTIVE") return "warm";
  return text.trim().endsWith("?") ? "curious" : "neutral";
}

const NOTES: Record<Emotion, string> = {
  warm: "warm and welcoming, with a gentle smile in the voice",
  curious: "genuinely curious and interested, leaning in",
  encouraging: "encouraging and sincere, pleased with what they just heard",
  empathetic: "kind and reassuring, calm and unhurried, like a mentor putting someone at ease",
  thoughtful: "thoughtful and measured, as if weighing the ideas while speaking",
  serious: "focused and direct, professional but not cold",
  upbeat: "bright and positive, with energy",
  neutral: "natural and conversational, relaxed and professional",
};

/** Director's note for Gemini TTS. */
/** Director's note for Gemini TTS. */
export function performanceNote(emotion: Emotion, hint: DeliveryHint = {}): string {
  const who =
    hint.role === "moderator"
      ? "a calm group-discussion moderator"
      : hint.role === "panelist"
        ? `a fellow candidate in a group discussion${hint.persona?.trait ? ` who is \${hint.persona.trait}` : ""}`
        : "an experienced interviewer talking with a candidate";
  const name = hint.persona?.name ? `${hint.persona.name}, ` : "";
  
  // This is the missing line that fixes the crash:
  return `You are ${name}${who}. Your delivery should be ${NOTES[emotion]}.`;
}

const MARKERS = /^(okay|ok|alright|all right|so|right|great|good|hmm|well|now|sure|got it|i see|interesting|nice|perfect|thanks|thank you)[,.!]?\s+/i;

/**
 * Light breath marks for TTS: a comma after an opening discourse marker
 * ("Okay, so…"). Earlier versions added ellipses, which the voice model
 * rendered as long, unnatural silences.
 */
export function withNaturalPauses(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  out = out.replace(MARKERS, (m) => `${m.trim().replace(/[,.!]$/, "")}, `);
  return out.replace(/…/g, ",").replace(/,\s*,/g, ",");
}

interface Prosody {
  rate: number;
  pitch: number;
  /** Multiplies the pauses between phrases. */
  pause: number;
}

export const PROSODY: Record<Emotion, Prosody> = {
  warm: { rate: 0.96, pitch: 1.04, pause: 1.1 },
  curious: { rate: 1.0, pitch: 1.05, pause: 1.0 },
  encouraging: { rate: 1.0, pitch: 1.07, pause: 0.95 },
  empathetic: { rate: 0.92, pitch: 0.98, pause: 1.35 },
  thoughtful: { rate: 0.93, pitch: 0.97, pause: 1.3 },
  serious: { rate: 1.02, pitch: 0.94, pause: 0.85 },
  upbeat: { rate: 1.04, pitch: 1.08, pause: 0.9 },
  neutral: { rate: 0.98, pitch: 1.0, pause: 1.0 },
};

export interface PhraseStep {
  text: string;
  rate: number;
  pitch: number;
  /** Silence after this phrase, in ms. */
  pauseAfterMs: number;
}

/** Split a line into spoken phrases with per-phrase pitch, rate and pauses. */
export function phrasePlan(phrases: string[], emotion: Emotion, base: { rate?: number; pitch?: number } = {}, random = Math.random): PhraseStep[] {
  const p = PROSODY[emotion];
  const steps: PhraseStep[] = [];
  const expanded: string[] = [];
  for (const phrase of phrases) {
    const m = MARKERS.exec(phrase);
    if (m && phrase.length - m[0].length > 12) {
      expanded.push(m[0].trim(), phrase.slice(m[0].length).trim());
    } else expanded.push(phrase);
  }
  expanded.forEach((text, i) => {
    const isMarker = MARKERS.test(`${text} `) && text.split(/\s+/).length <= 3;
    const isQuestion = text.endsWith("?");
    const next = expanded[i + 1];
    const jitter = random() * 110;
    let pause = text.endsWith(",") ? 150 : isMarker ? 260 : isQuestion ? 420 : 300;
    // A thinking beat before the question that follows a reaction.
    if (next?.endsWith("?") && !isQuestion) pause += 220;
    steps.push({
      text,
      rate: (base.rate ?? 1) * p.rate * (isMarker ? 0.94 : 0.97 + random() * 0.06),
      pitch: Math.max(0.5, Math.min(2, (base.pitch ?? 1) * p.pitch * (isQuestion ? 1.04 : 1))),
      pauseAfterMs: Math.round((pause + jitter) * p.pause),
    });
  });
  if (steps.length) steps[steps.length - 1].pauseAfterMs = 0;
  return steps;
}
