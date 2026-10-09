import { NextRequest, NextResponse } from "next/server";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

async function callGemini(prompt: string, temperature = 0.85, maxTokens = 160): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return "";
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function callGeminiJSON(prompt: string): Promise<Record<string, unknown>> {
  if (!process.env.GEMINI_API_KEY) return {};
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.4, responseMimeType: "application/json" },
    }),
  });
  const data = await res.json();
  try { return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"); }
  catch { return {}; }
}

const GD_TOPICS = [
  "Is Artificial Intelligence a threat or an opportunity for the future workforce?",
  "Should social media platforms be regulated by governments?",
  "Remote work vs office work — what is the future of corporate culture?",
  "Is entrepreneurship better than a corporate career for the youth of today?",
  "Climate change: Individual responsibility vs corporate accountability",
  "Should college education be free for everyone?",
  "Is work-life balance a myth in today's competitive world?",
  "Technology is making us more connected but less social — agree or disagree?",
  "Should AI be used in hiring and performance evaluations?",
  "Is online education as effective as traditional classroom learning?",
];

const AGENT_PERSONAS: Record<string, string> = {
  dominator:        `You are Alex, assertive and leadership-focused. Use phrases like "I strongly believe...", "Let me be clear...", "To be frank...". Lead the narrative. 2-3 sentences max.`,
  "silent-thinker": `You are Sam, a deep thinker who speaks rarely but insightfully. Use "What we're missing is...", "There's another angle here...". 2-3 sentences max.`,
  aggressive:       `You are Ryan, who challenges points professionally. Use "I disagree...", "That's not accurate...", "The data shows...". Be direct. 2-3 sentences max.`,
  supportive:       `You are Maya, who builds on others' ideas. Use "Building on that...", "I agree and would add...", "That's a great point...". 2-3 sentences max.`,
  logical:          `You are Chris, a structured analyst. Use "From a logical standpoint...", "The evidence suggests...", "Breaking this down...". 2-3 sentences max.`,
};

const FALLBACK_SPEECHES: Record<string, string[]> = {
  dominator:        ["I strongly believe we must take a decisive stance on this issue.", "Let me be direct — the core challenge here demands bold leadership.", "To be frank, vague positions will not move this discussion forward."],
  "silent-thinker": ["Hmm... what we are missing is the long-term second-order effect of this approach.", "There is a nuanced angle here that has not been fully explored.", "Actually, there is another dimension worth considering carefully."],
  aggressive:       ["I disagree — the evidence tells a very different story here.", "That assumption is flawed. The real data directly contradicts this.", "We are oversimplifying this issue significantly."],
  supportive:       ["Building on that point, I think there is an important dimension to add.", "I agree, and I would complement it with a real-world example.", "That is a valuable insight — let me expand on it further."],
  logical:          ["From a logical standpoint, we should weigh both immediate and long-term implications.", "The evidence suggests a structured, systematic approach works best.", "Breaking this down: there are three key dimensions to consider."],
};

const INTERRUPTION_TIPS = [
  "To interrupt respectfully, raise your hand and say: I'd like to add to that point — this shows engagement.",
  "A good interruption: Excuse me, building on what you said — acknowledges the speaker while making space for you.",
  "Try: That's interesting — may I add a related thought? Confident yet polite.",
  "Wait for a natural pause, lean forward, and say 'If I may...' — soft words with confident delivery.",
];

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 20_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    const body = await req.json();
    const { action, topic, agentId, messages, userSpeech } = body;

    if (action === "get_topic") {
      return NextResponse.json({ topic: GD_TOPICS[Math.floor(Math.random() * GD_TOPICS.length)] });
    }

    if (action === "interruption_tip") {
      return NextResponse.json({ tip: INTERRUPTION_TIPS[Math.floor(Math.random() * INTERRUPTION_TIPS.length)] });
    }

    if (action === "agent_speak") {
      const safeAgentId = typeof agentId === "string" ? agentId : "supportive";
      const persona = AGENT_PERSONAS[safeAgentId] ?? AGENT_PERSONAS.supportive;
      const safeTopic = typeof topic === "string" ? topic.slice(0, 300) : "General discussion";
      const context = Array.isArray(messages)
        ? messages.slice(-8).map((m: { agent: string; text: string }) => `${m.agent}: ${m.text}`).join("\n")
        : "(Discussion just started)";
      const prompt = `${persona}\n\nGroup Discussion Topic: "${safeTopic}"\n\nConversation so far:\n${context}\n\nSpeak your turn now. Stay in character. 2-3 sentences only. Do not use asterisks or markdown.`;
      const speech = await callGemini(prompt, 0.9, 130);
      if (!speech) {
        const lines = FALLBACK_SPEECHES[safeAgentId] ?? FALLBACK_SPEECHES.supportive;
        return NextResponse.json({ speech: lines[Math.floor(Math.random() * lines.length)] });
      }
      return NextResponse.json({ speech });
    }

    if (action === "hand_raise_decision") {
      const safeAiName = typeof body.aiName === "string" ? body.aiName : (typeof agentId === "string" ? agentId : "AI Candidate");
      const { personality, previousSpeakers, speakingCount } = body as {
        personality: string;
        previousSpeakers: Array<{ name: string; snippet: string }>;
        speakingCount: number;
      };
      const safeTopic = typeof topic === "string" ? topic.slice(0, 300) : "General discussion";
      const safePersonality = typeof personality === "string" ? personality.slice(0, 200) : "thoughtful participant";
      const prevContext = Array.isArray(previousSpeakers)
        ? previousSpeakers.slice(-4).map((s) => `${s.name}: "${s.snippet}"`).join("\n")
        : "None yet";
      const prompt = `You are ${safeAiName}, an AI candidate in a group discussion interview.

Personality: ${safePersonality}
Discussion question: "${safeTopic}"
Previous speakers in this round:
${prevContext}
Your speaking count so far: ${typeof speakingCount === "number" ? speakingCount : 0}

Rules:
- Raise hand if you have a strong, unique point not yet covered
- If someone already said your main point, wait
- If speakingCount >= 3, be very selective
- Your personality influences your eagerness to speak

Respond with ONLY one word — either RAISE_HAND or WAIT`;
      const raw = await callGemini(prompt, 0.4, 8);
      return NextResponse.json({ decision: raw.includes("RAISE_HAND") ? "RAISE_HAND" : "WAIT" });
    }

    if (action === "generate_answer") {
      const { aiName, personality, conversationHistory } = body as {
        aiName: string;
        personality: string;
        conversationHistory: Array<{ speakerName: string; text: string }>;
      };
      const safeTopic = typeof topic === "string" ? topic.slice(0, 300) : "General discussion";
      const safePersonality = typeof personality === "string" ? personality.slice(0, 300) : "thoughtful professional";
      const historyContext = Array.isArray(conversationHistory)
        ? conversationHistory.slice(-5).map((m) => `${m.speakerName}: ${m.text}`).join("\n")
        : "(You are speaking first)";
      const prompt = `You are ${aiName}, an AI candidate in a group discussion interview.

Personality: ${safePersonality}

Topic: "${safeTopic}"

Recent conversation:
${historyContext}

Rules:
- Speak 2-3 sentences only
- Stay professional and confident
- Build on, agree with, or respectfully challenge previous points
- Stay true to your personality
- Do NOT use asterisks, markdown, or quotes around your response

Give your response now:`;
      const speech = await callGemini(prompt, 0.88, 160);
      const fallback = `From my perspective on this topic, I believe we need to consider all angles carefully before drawing conclusions.`;
      return NextResponse.json({ speech: speech || fallback });
    }

    if (action === "moderator_speak") {
      const { situation, targetParticipant } = body as {
        situation: "introduce" | "select_speaker" | "encourage_silent" | "follow_up" | "wrap_up";
        targetParticipant?: string;
      };
      const safeTopic = typeof topic === "string" ? topic.slice(0, 300) : "today's topic";
      const MODERATOR_PROMPTS: Record<string, string> = {
        introduce: `You are a professional GD moderator. In 2 sentences, introduce this discussion topic engagingly and neutrally: "${safeTopic}". Then invite participants to share their thoughts.`,
        select_speaker: `You are a GD moderator. In exactly 1 sentence, invite ${targetParticipant || "the next participant"} to share their thoughts on "${safeTopic}". Be professional and encouraging.`,
        encourage_silent: `You are a GD moderator. ${targetParticipant || "A participant"} has not yet spoken. In 1 sentence, gently invite them to share their perspective on "${safeTopic}".`,
        follow_up: `You are a GD moderator. The group has been discussing "${safeTopic}". Ask a 1-sentence follow-up question that deepens the discussion or explores a different angle.`,
        wrap_up: `You are a GD moderator. Wrap up the group discussion on "${safeTopic}" in 2 professional sentences. Thank participants and give a brief neutral closing remark.`,
      };
      const prompt = MODERATOR_PROMPTS[situation] ?? MODERATOR_PROMPTS.introduce;
      const speech = await callGemini(prompt, 0.7, 110);
      return NextResponse.json({ speech: speech || `Thank you all for participating in this discussion on ${safeTopic}.` });
    }

    if (action === "evaluate_participation") {
      const safeTopic = typeof topic === "string" ? topic.slice(0, 300) : "General";
      const safeUserSpeech = typeof userSpeech === "string" ? userSpeech.slice(0, 2000) : "";
      if (!safeUserSpeech || !process.env.GEMINI_API_KEY) {
        return NextResponse.json({ score: 55, summary: "You observed but did not actively contribute. Participation is key in GD rounds.", strengths: ["Joined the session", "Listened attentively"], improvements: ["Speak at least 3 times", "Use structured arguments"] });
      }
      const prompt = `Evaluate this user's group discussion participation on topic: "${safeTopic}". Their contributions: "${safeUserSpeech}". Return JSON only: {"score":<0-100>,"summary":"<2-3 sentences>","strengths":["<s1>","<s2>"],"improvements":["<i1>","<i2>"]}`;
      const result = await callGeminiJSON(prompt);
      if (!result.score) return NextResponse.json({ score: 70, summary: "Good participation overall.", strengths: ["Engaged actively"], improvements: ["Use more structured arguments"] });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("/api/gd error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
