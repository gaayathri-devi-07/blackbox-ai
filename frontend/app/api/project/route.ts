import { NextRequest, NextResponse } from "next/server";

interface ProjectQuestion {
  id: number;
  question: string;
}

async function callGemini(system: string, userMessages: { role: string; content: string }[], maxTokens = 400): Promise<string> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const contents = userMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  if (!contents.length || contents[contents.length - 1].role !== "user") {
    contents.push({ role: "user", parts: [{ text: "Continue." }] });
  }
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
  });
  const data = await res.json();
  if (data.error) console.error("Gemini error:", JSON.stringify(data.error));
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGeminiJSON(system: string, userText: string): Promise<Record<string, unknown>> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.6, responseMimeType: "application/json" },
    }),
  });
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try { return JSON.parse(cleaned); }
  catch { return {}; }
}

function normalizeQuestions(result: Record<string, unknown>): ProjectQuestion[] {
  const rawQuestions = Array.isArray(result)
    ? result
    : Array.isArray(result.questions)
      ? result.questions
      : [];

  const normalized = rawQuestions
    .map((item, index) => {
      if (typeof item === "string") return { id: index + 1, question: item.trim() };
      if (item && typeof item === "object") {
        const question = "question" in item ? String((item as { question?: unknown }).question ?? "").trim() : "";
        const idCandidate = "id" in item ? Number((item as { id?: unknown }).id) : index + 1;
        return { id: Number.isFinite(idCandidate) && idCandidate > 0 ? idCandidate : index + 1, question };
      }
      return { id: index + 1, question: "" };
    })
    .filter((q) => q.question.length > 0);

  return normalized.slice(0, 6);
}

function fallbackQuestions(projectDescription: string): ProjectQuestion[] {
  const snippet = projectDescription.split(/\s+/).slice(0, 20).join(" ");
  return [
    { id: 1, question: "Can you walk me through the architecture of this project end-to-end?" },
    { id: 2, question: "What key technical decisions did you make, and what trade-offs did you evaluate?" },
    { id: 3, question: "What was the hardest challenge you faced, and how did you solve it?" },
    { id: 4, question: "How does your solution handle scale, performance, and reliability?" },
    { id: 5, question: "If you had more time, what would you improve or refactor first?" },
    { id: 6, question: `Based on "${snippet}...", what should an interviewer ask to validate ownership and depth?` },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { action, projectDescription, messages } = await req.json();

    if (action === "analyze") {
      if (typeof projectDescription !== "string" || !projectDescription.trim()) {
        return NextResponse.json({ questions: [] }, { status: 400 });
      }
      const result = await callGeminiJSON(
        "You are a senior technical interviewer. Given a project description, generate exactly 6 interview questions that a real interviewer would ask about this project. Return as JSON: {\"questions\":[{\"id\":1,\"question\":\"...\"}]}. Mix technical depth, architecture decisions, challenges, and improvements. Be specific to the project.",
        `Project: ${projectDescription}`
      );
      const questions = normalizeQuestions(result);
      if (!questions.length) {
        return NextResponse.json({ questions: fallbackQuestions(projectDescription) });
      }
      return NextResponse.json({ questions });
    }

    if (action === "answer") {
      const message = await callGemini(
        `You are an expert technical interviewer reviewing a candidate's answer about their project.
Provide:
1. ✅ What was good about the answer (1-2 bullets)
2. 💡 How to improve it (1-2 bullets)
3. 🎯 A stronger version of the answer (2-3 sentences)

Be specific and concise. Total response under 200 words.`,
        messages
      );
      return NextResponse.json({ message });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("/api/project error:", error);
    return NextResponse.json({ message: "Something went wrong." }, { status: 500 });
  }
}
