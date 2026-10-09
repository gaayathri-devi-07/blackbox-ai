import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Company-specific interview styles ────────────────────────────────────────
const COMPANY_STYLES: Record<string, string> = {
  google: `
    Focus on: System design, algorithms, data structures, leadership principles.
    Ask about: Scalability, trade-offs, problem-solving approach.
    Style: Collaborative but challenging. Push for optimal solutions.
    Use Google's values: Think big, user focus, data-driven decisions.
  `,
  amazon: `
    Focus heavily on Amazon Leadership Principles (customer obsession, 
    ownership, invent & simplify, hire & develop the best, bias for action).
    Ask STAR-format behavioral questions. Push for specific examples.
    Style: Direct, metrics-focused. Ask "tell me about a time when..."
  `,
  microsoft: `
    Focus on: Growth mindset, collaboration, technical depth, problem solving.
    Ask about: Past projects, conflict resolution, technical decisions.
    Style: Empathetic but rigorous. Value diversity of thought.
  `,
  apple: `
    Focus on: Craft, attention to detail, user experience thinking, innovation.
    Ask about: How they've improved existing systems, cross-functional work.
    Style: High standards, quality over quantity. Ask about trade-offs.
  `,
  deloitte: `
    Focus on: Client management, consulting frameworks, business analysis,
    stakeholder communication, problem structuring.
    Ask case-style questions. Value structured thinking.
    Style: Professional, formal, business-oriented.
  `,
  tcs: `
    Focus on: Technical skills, project experience, team collaboration,
    process adherence, client communication.
    Ask about: Specific technologies used, project challenges, teamwork.
    Style: Structured, process-oriented, professional.
  `,
  accenture: `
    Focus on: Innovation, digital transformation, consulting mindset,
    adaptability, client focus.
    Ask about: Change management, cross-functional projects, tech trends.
    Style: Dynamic, forward-thinking, values diversity.
  `,
};

// ── Role-specific focus areas ─────────────────────────────────────────────────
const ROLE_FOCUS: Record<string, string> = {
  "software-engineer": "coding, system design, algorithms, technical architecture",
  "finance-analyst": "financial modeling, market analysis, valuation, Excel/Python, risk assessment",
  "product-manager": "product strategy, roadmap, metrics, user research, prioritization",
  "data-scientist": "ML models, statistics, data pipelines, business insights, Python/SQL",
  "consultant": "problem structuring, case studies, client communication, frameworks",
  "marketing": "campaigns, brand strategy, digital marketing, analytics, growth",
  "hr": "talent acquisition, employee relations, HR policies, people management",
};

// ── Build system prompt ───────────────────────────────────────────────────────
function buildSystemPrompt(
  company: string,
  role: string,
  experience: string,
  mode: string
): string {
  const companyStyle = COMPANY_STYLES[company] ?? 
    "Be professional, thorough, and realistic.";
  const roleFocus = ROLE_FOCUS[role] ?? 
    `${role} specific skills and experience`;
  const isPractice = mode === "friendly";

  return `
    You are a senior interviewer at ${company.toUpperCase()}.
    You are conducting a ${experience} level interview for a ${role} position.
    
    COMPANY STYLE:
    ${companyStyle}
    
    ROLE FOCUS:
    Ask questions specifically about: ${roleFocus}
    
    ${isPractice ? `
    PRACTICE MODE:
    - Be encouraging and supportive
    - Give hints if the candidate struggles
    - Use a friendly, coaching tone
    - Still ask realistic questions but be more forgiving
    ` : `
    PROFESSIONAL MODE:
    - Be formal and rigorous
    - Do not give hints
    - Challenge weak answers with follow-ups
    - Maintain high standards
    `}
    
    STRICT RULES:
    - Ask ONLY ONE question per response
    - Keep questions concise — you are speaking out loud (max 3 sentences)
    - Never say you are an AI
    - Stay in character as a real interviewer at ${company}
    - Tailor every question to the ${experience} experience level
    - For senior roles: ask about leadership, architecture, strategic decisions
    - For fresher/junior roles: ask about fundamentals, learning approach, projects
  `;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── Stats tracking (just acknowledge, no DB needed for now) ──
    if (action === "stats_increment") {
      return NextResponse.json({ ok: true });
    }

    // ── START: Get opening question ───────────────────────────────
    if (action === "start") {
      const { company, role, experience, mode } = body;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        ${buildSystemPrompt(company, role, experience, mode)}
        
        This is the START of the interview.
        Greet the candidate warmly with their interviewer name context,
        then ask your first question.
        Keep it to 2-3 sentences total.
        Make the greeting feel natural and human.
        Example format: "Hi, welcome to [company]! I'm [role here]. 
        Let's start — [first question]?"
      `;

      const result = await model.generateContent(prompt);
      const question = result.response.text();

      return NextResponse.json({ question });
    }

    // ── NEXT: Get next question based on conversation ─────────────
    if (action === "next") {
      const { company, role, experience, mode, messages, questionIndex } = body;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      // After 5 questions, end the interview
      if (questionIndex >= 4) {
        return NextResponse.json({ done: true });
      }

      // Build conversation history for context
      const conversationHistory = messages
        .map((m: { role: string; content: string }) =>
          `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`
        )
        .join("\n\n");

      const prompt = `
        ${buildSystemPrompt(company, role, experience, mode)}
        
        CONVERSATION SO FAR:
        ${conversationHistory}
        
        This is question ${questionIndex + 2} of 5.
        
        Based on the candidate's last answer:
        - If strong: acknowledge briefly and ask a deeper follow-up or new topic
        - If weak: ask a clarifying question or pivot to a different angle
        - If vague: push back with "Can you give me a specific example?"
        
        Ask your next question now. ONE question only. Max 2 sentences.
        Do NOT repeat any question already asked above.
      `;

      const result = await model.generateContent(prompt);
      const question = result.response.text();

      return NextResponse.json({ question, done: false });
    }

    // ── FEEDBACK: Practice mode — evaluate one answer ─────────────
    if (action === "feedback") {
      const { company, question, answer } = body;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are evaluating a candidate's interview answer at ${company}.
        
        Question asked: "${question}"
        Candidate's answer: "${answer}"
        
        Respond ONLY with valid JSON in this exact format (no markdown, no backticks):
        {
          "idealAnswer": "A 2-3 sentence example of what a great answer looks like",
          "corrections": ["correction 1 if any", "correction 2 if any"],
          "score": 75,
          "tip": "One specific actionable tip for improvement"
        }
        
        Score from 0-100 based on: relevance, specificity, structure, confidence.
        corrections array can be empty [] if answer was good.
        Keep all text concise and constructive.
      `;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();

      // Strip markdown code blocks if present
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const feedback = JSON.parse(text);
        return NextResponse.json(feedback);
      } catch {
        // Fallback if JSON parse fails
        return NextResponse.json({
          idealAnswer: "Use the STAR method: Situation, Task, Action, Result. Be specific with metrics.",
          corrections: [],
          score: 70,
          tip: "Add specific numbers and outcomes to make your answer more compelling.",
        });
      }
    }

    // ── EVALUATE: Final scoring after all questions ───────────────
    if (action === "evaluate") {
      const { company, role, experience, messages, eyeContact, userId } = body;
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const conversationHistory = messages
        .map((m: { role: string; content: string }) =>
          `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`
        )
        .join("\n\n");

      const prompt = `
        You are evaluating a complete mock interview at ${company} 
        for a ${experience} ${role} position.
        
        FULL INTERVIEW TRANSCRIPT:
        ${conversationHistory}
        
        Eye contact score from webcam analysis: ${eyeContact ?? 75}%
        
        Respond ONLY with valid JSON (no markdown, no backticks):
        {
          "overallScore": 78,
          "communication": 80,
          "technical": 75,
          "problemSolving": 72,
          "confidence": 82,
          "strengths": [
            "Clear and structured communication",
            "Good use of specific examples",
            "Strong technical foundation"
          ],
          "improvements": [
            "Quantify achievements with metrics",
            "Deeper system design knowledge needed",
            "Reduce filler words like 'um' and 'uh'"
          ],
          "verdict": "Almost Ready",
          "verdictReason": "Strong communication skills with room to deepen technical depth. 2-3 more practice sessions recommended.",
          "nextSteps": [
            "Practice system design problems on LeetCode",
            "Prepare 5 STAR stories with specific metrics",
            "Record yourself and review filler word usage"
          ]
        }
        
        verdict must be exactly one of: "Ready" / "Almost Ready" / "Needs More Prep"
        All scores 0-100. Be honest and constructive.
        Strengths and improvements: exactly 3 each.
        nextSteps: exactly 3 actionable items.
      `;

      const result = await model.generateContent(prompt);
      let text = result.response.text().trim();
      text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      try {
        const evaluation = JSON.parse(text);
        const transcriptPairs = messages
          .filter((m: { role: string }) => m.role === "assistant" || m.role === "user")
          .slice(-10);
        const idealAnswers = transcriptPairs
          .reduce((acc: Array<{ question: string; userAnswer: string; idealAnswer: string }>, m: { role: string; content: string }, i: number, arr: Array<{ role: string; content: string }>) => {
            if (m.role === "assistant" && arr[i + 1]?.role === "user") {
              acc.push({
                question: m.content,
                userAnswer: arr[i + 1].content,
                idealAnswer: "Use STAR format with specific metrics, clear ownership, and outcome impact.",
              });
            }
            return acc;
          }, [])
          .slice(0, 5);

        return NextResponse.json({
          ...evaluation,
          finalScore: evaluation.overallScore ?? 70,
          starRating: Math.max(1, Math.min(5, Math.round((evaluation.overallScore ?? 70) / 20))),
          actionChecklist: (evaluation.nextSteps ?? evaluation.improvements ?? []).slice(0, 5),
          idealAnswers,
        });
      } catch {
        // Fallback evaluation
        return NextResponse.json({
          overallScore: 72,
          communication: 75,
          technical: 70,
          problemSolving: 70,
          confidence: 73,
          strengths: [
            "Showed genuine enthusiasm for the role",
            "Communicated ideas clearly",
            "Good listening and responsiveness",
          ],
          improvements: [
            "Use more specific metrics in answers",
            "Deepen technical knowledge for the role",
            "Structure answers using STAR method",
          ],
          verdict: "Almost Ready",
          verdictReason: "Good foundation — a few more practice sessions will get you there.",
          nextSteps: [
            "Practice 2 mock interviews per week",
            "Study role-specific technical concepts",
            "Prepare quantified achievement stories",
          ],
          finalScore: 72,
          starRating: 4,
          actionChecklist: [
            "Practice 2 mock interviews per week",
            "Study role-specific technical concepts",
            "Prepare quantified achievement stories",
          ],
          idealAnswers: [],
        });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (error) {
    console.error("Interview API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
