/** AI participants in the group discussion room. Shared by client and server. */

export type GDAgentId = "ai1" | "ai2" | "ai3" | "ai4";

/**
 * Each panelist argues from a fixed stance, so the discussion has real
 * opposition: the Optimist and the Skeptic take opposite sides by design; the
 * Pragmatist tests ideas against reality and the Synthesizer finds common ground.
 */
export type GDStance = "optimist" | "skeptic" | "pragmatist" | "synthesizer";

export interface GDAgent {
  id: GDAgentId;
  name: string;
  initials: string;
  /** Persona title shown on the tile. */
  label: string;
  stance: GDStance;
  /** What this persona always looks for. */
  focus: string;
  /** Prompt description of how this candidate argues. */
  persona: string;
  /** Gemini voice and delivery used when AI voices are available. */
  aiVoice: string;
  speakingStyle: string;
  /** 0–1: how readily the agent requests the floor when it is open. */
  eagerness: number;
  video: string;
}

export const GD_AGENTS: Record<GDAgentId, GDAgent> = {
  ai1: {
    id: "ai1",
    name: "Alex Chen",
    initials: "AC",
    label: "The Optimist",
    stance: "optimist",
    focus: "innovation, adoption and the upside for people and businesses",
    persona:
      "An optimist who argues FOR the motion. Champions innovation and adoption: what becomes possible, who benefits, how fast people adopt it. Answers risks with how they can be managed, never by ignoring them.",
    aiVoice: "Puck",
    speakingStyle: "with upbeat, confident energy",
    eagerness: 0.7,
    video: "/ai1.mp4",
  },
  ai2: {
    id: "ai2",
    name: "Maya Patel",
    initials: "MP",
    label: "The Pragmatist",
    stance: "pragmatist",
    focus: "what it actually takes to make this work in real teams: cost, skills, timelines",
    persona:
      "Practical and down to earth. Tests every idea against what really happens in companies: who does the work, what it costs, how long it takes. Agrees or disagrees based on feasibility.",
    aiVoice: "Aoede",
    speakingStyle: "in a friendly, practical, conversational way",
    eagerness: 0.55,
    video: "/ai2.mp4",
  },
  ai3: {
    id: "ai3",
    name: "Ryan Blake",
    initials: "RB",
    label: "The Skeptic",
    stance: "skeptic",
    focus: "edge cases, scalability, failure modes, hidden costs and who gets hurt",
    persona:
      "A skeptic who argues AGAINST the motion. Politely stress-tests the last claim: what breaks at scale, which edge cases were ignored, what it really costs, who is left out. Asks for evidence.",
    aiVoice: "Fenrir",
    speakingStyle: "with measured, probing seriousness",
    eagerness: 0.75,
    video: "/ai3.mp4",
  },
  ai4: {
    id: "ai4",
    name: "Sam Kim",
    initials: "SK",
    label: "The Synthesizer",
    stance: "synthesizer",
    focus: "where the group agrees and a practical middle ground",
    persona: "A good listener. Connects what others said by name, notices where the group agrees, and proposes a practical middle ground.",
    aiVoice: "Iapetus",
    speakingStyle: "in a warm, measured voice, like someone bringing the group together",
    eagerness: 0.45,
    video: "/ai4.mp4",
  },
};

/** The persona most likely to answer a given speaker (opposite stance first). */
export function naturalResponder(speakerId: string): GDAgentId {
  if (speakerId === "ai1") return "ai3";
  if (speakerId === "ai3") return "ai1";
  if (speakerId === "ai2") return "ai4";
  return "ai3";
}

export const GD_AGENT_IDS = Object.keys(GD_AGENTS) as GDAgentId[];

export const GD_MODERATOR = {
  id: "moderator",
  name: "Dr. Raj Mehta",
  title: "Panel Moderator",
  aiVoice: "Orus",
  speakingStyle: "clearly and calmly, like a moderator guiding a panel",
} as const;
