/**
 * HandRaiseEngine — decides whether an AI participant should raise hand.
 * Two-stage gate: probability check first, then LLM decision via API.
 */

export interface HandRaiseInput {
  aiId: string;
  aiName: string;
  personality: string;
  question: string;
  previousSpeakers: Array<{ name: string; snippet: string }>;
  speakingCount: number;
}

/**
 * Returns true if this AI should raise their hand to speak.
 * @param input           AI identity + discussion context
 * @param raiseProbability Base probability (0–1) for this AI's eagerness
 */
export async function decideHandRaise(
  input: HandRaiseInput,
  raiseProbability: number
): Promise<boolean> {
  // Reduce probability if AI has already spoken multiple times
  const adjustedProb = Math.max(0.1, raiseProbability - input.speakingCount * 0.15);

  // Fast probability gate — skips LLM call for obvious NO cases
  if (Math.random() > adjustedProb * 1.4) return false;

  try {
    const res = await fetch("/api/gd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "hand_raise_decision",
        aiName: input.aiName,
        topic: input.question,
        personality: input.personality,
        previousSpeakers: input.previousSpeakers,
        speakingCount: input.speakingCount,
      }),
    });
    if (!res.ok) throw new Error("API error");
    const { decision } = await res.json();
    return decision === "RAISE_HAND";
  } catch {
    // Fallback to pure probability when API fails
    return Math.random() < adjustedProb;
  }
}
