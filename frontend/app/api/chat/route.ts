import { NextRequest, NextResponse } from "next/server";

const CAREER_LABELS: Record<string, string> = {
  "software-dev": "Software Developer / Full-Stack Engineer",
  "ai-ml": "AI / Machine Learning Engineer",
  "data-scientist": "Data Scientist / Data Analyst",
  "cloud-engineer": "Cloud / DevOps / Infrastructure Engineer",
  "product-analyst": "Product Analyst / Business Analyst",
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  "Technical": "technical interview questions specific to the role, including coding concepts, system design, tools, frameworks, and domain knowledge",
  "HR & Behavioral": "HR and behavioral interview questions relevant to this career path, using STAR-method scenarios, values, motivation, and soft skills",
  "Communication": "communication and presentation-style interview questions for this career, including how they explain work to stakeholders, cross-team collaboration, and written/verbal communication",
  "Body Language & Confidence": "questions about confidence, non-verbal presence, managing interview stress, and professional presentation for this career field",
};

// Use the specified model: gemini-2.5-flash (stable model)
const MODELS = ["gemini-2.5-flash"];

async function callGemini(
  contents: { role: string; parts: { text: string }[] }[],
  maxTokens = 1024,
  timeout = 25000 // 25 second timeout
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in .env.local");

  const errors: string[] = [];

  // Use v1 since gemini-2.5-flash is a stable model (not preview)
  const version = "v1";
  const model = "gemini-2.5-flash";
  
  try {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Trying Gemini API: ${version}/${model}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    // Check if response is actually JSON before parsing
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await res.text();
      const msg = `${version}/${model}: Got non-JSON response (status ${res.status}): ${textResponse.substring(0, 200)}`;
      errors.push(msg);
      throw new Error(msg);
    }

    const data = await res.json();
    
    console.log(`Response from ${version}/${model}:`, JSON.stringify(data).substring(0, 200));

    if (data.error) {
      const msg = `${version}/${model}: [${data.error.code}] ${data.error.message}`;
      errors.push(msg);
      throw new Error(msg);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      console.log(`✅ Success with ${version}/${model}`);
      return text;
    }
    
    const msg = `${version}/${model}: No text in response`;
    errors.push(msg);
    throw new Error(msg);
    
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
    console.error(`❌ Failed with ${version}/${model}:`, msg);
  }

  // If we get here, all attempts failed
  throw new Error(
    `All Gemini API attempts failed:\n${errors.join("\n")}\n\nCheck:\n1. GEMINI_API_KEY is set correctly\n2. API key has permissions\n3. Network connection\n4. Model availability`
  );
}

const COMPANION_PERSONAS: Record<string, string> = {
  luna: "You are Luna, a calm and wise AI interview coach. Be encouraging, clear, and supportive.",
  nova: "You are Nova, an energetic AI interview coach. Be enthusiastic, direct, and motivating.",
  stella: "You are Stella, a warm AI interview coach. Be nurturing, detailed, and cheerful.",
  orion: "You are Orion, a strategic AI interview coach. Be analytical, structured, and efficient.",
  cosmo: "You are Cosmo, a creative AI interview coach. Use creative metaphors and keep it engaging.",
};

const DEFAULT_SYSTEM = `You are an expert AI interview coach. Help candidates prepare for job interviews by:
- Answering any question clearly and in detail
- Explaining interview concepts, techniques, and best practices
- Reviewing and improving answers the user shares
- Giving actionable, specific feedback with real examples
- Covering behavioral, technical, communication, and HR interview topics

Be thorough and friendly. Use bullet points when listing multiple items.`;

// ── Fallback questions when Gemini API is unavailable ────────────────────────
function generateFallbackQuestions(career: string, category: string) {
  const careerLabel = CAREER_LABELS[career] ?? career;
  const baseQuestions = {
    "Technical": [
      { question: "Tell me about a complex technical problem you solved recently.", difficulty: "Medium", weak: "I fixed a bug in production.", strong: "In our payment service, users reported intermittent timeouts. I traced it to a database connection pool exhaustion caused by long-running queries during peak traffic. I implemented query optimization (reducing execution time from 8s to 200ms), added connection pool monitoring, and introduced a circuit breaker pattern. This reduced timeout errors by 95% and improved checkout success rate from 92% to 98.5%.", explanation: "The weak answer lacks detail and impact. The strong answer shows problem diagnosis, specific solution, and measurable results.", tip: "Always quantify the impact of your technical solutions with metrics." },
      { question: "How do you approach debugging a production issue?", difficulty: "Medium", weak: "I check the logs and fix the code.", strong: "I follow a systematic approach: (1) Verify the issue is real using monitoring dashboards and user reports. (2) Isolate — check if it's environment-specific or affects all users. (3) Reproduce locally if possible. (4) Add targeted logging without affecting performance. (5) Form hypotheses ranked by likelihood. (6) Test fixes in staging before production. (7) Monitor post-deployment. This saved us when a 'memory leak' turned out to be a legitimate cache growth pattern that needed tuning, not fixing.", explanation: "Structure and real examples show experience. Mentioning that not all 'bugs' need fixing shows judgment.", tip: "Always verify the problem before jumping to solutions — 30% of reported issues aren't actually bugs." },
      { question: "Explain a technical concept to a non-technical stakeholder.", difficulty: "Easy", weak: "APIs are like messengers between systems.", strong: "I'd say: 'Think of an API like a waiter at a restaurant. You (the app) ask the waiter (API) for specific dishes (data). The waiter takes your order to the kitchen (database/server), brings back what you asked for, and handles any issues like the dish being unavailable. The menu is the API documentation — it tells you what you can order and how to ask for it.' This helps stakeholders understand why API design and documentation matter for our integration timeline.", explanation: "Metaphors are good, but the strong answer extends it to business impact, showing why it matters.", tip: "Always connect technical concepts to business outcomes or familiar experiences." }
    ],
    "HR & Behavioral": [
      { question: "Tell me about a time you had a conflict with a teammate.", difficulty: "Medium", weak: "I had a disagreement with a coworker about priorities. We talked and figured it out.", strong: "Our frontend developer wanted deeply nested JSON for UI rendering, while I advocated for a flat API structure for performance. Instead of arguing in Slack, I scheduled a 30-minute call. I started by asking them to explain their use case — their complex tree UI made nested data cleaner. I shared my benchmarks showing the nested approach added 200ms latency. We brainstormed and landed on flat data with a relationship map, and I wrote a client-side transformer for them. The API shipped on time, performed great, and we reused this pattern in 3 other endpoints. I learned that technical conflicts often hide valid use cases — listening first turns disagreements into better solutions.", explanation: "The weak answer is vague. The strong answer uses STAR format, shows empathy, collaboration, and learning.", tip: "Never blame the other person. Focus on what YOU did to resolve the conflict professionally." },
      { question: "Describe a time you failed and what you learned.", difficulty: "Hard", weak: "I missed a deadline once. I learned to manage my time better.", strong: "During a major product launch, I underestimated API integration complexity and missed our go-live date by 3 days, delaying marketing campaigns worth $50K in ad spend. I had assumed the third-party API documentation was complete, but it had undocumented rate limits and authentication quirks that took days to debug. After launch, I implemented three changes: (1) Always allocate 30% buffer time for integration work. (2) Start with a proof-of-concept call to the API before planning. (3) Request sandbox access early to test edge cases. Since then, I've delivered 8 integrations on time, and my team adopted the POC-first approach. This failure taught me that assumptions in integration work always cost more than validation upfront.", explanation: "Admitting real failure with specific impact shows honesty. Detailing concrete lessons and follow-through shows growth.", tip: "Choose a real failure with a clear lesson learned. Avoid blaming others or picking something trivial." },
      { question: "Why should we hire you for this role?", difficulty: "Easy", weak: "I'm a hard worker and a fast learner.", strong: "Based on your job description, you need someone who can build scalable APIs, work cross-functionally with product teams, and mentor junior developers. In my last role as a backend engineer at TechCorp, I designed the payment API handling 50K transactions/day with 99.9% uptime, collaborated weekly with product managers to translate business requirements into technical specs, and mentored 2 junior engineers who are now mid-level contributors. What excites me about this role is the chance to work on real-time systems at your scale — I've been studying distributed systems design and I see opportunities to apply event-driven architectures based on your tech blog. I'm confident I can contribute from day one while continuing to grow in areas like Kubernetes orchestration.", explanation: "Generic traits are weak. The strong answer matches their needs with specific evidence and shows genuine interest.", tip: "Research the company and role. Map your experience directly to their job description." }
    ],
    "Communication": [
      { question: "How do you handle giving critical feedback to a teammate?", difficulty: "Medium", weak: "I tell them directly what they did wrong.", strong: "I use the SBI framework: Situation, Behavior, Impact. For example, when a teammate repeatedly missed code review deadlines, I scheduled a 1-on-1 and said: 'In our last three sprints (Situation), code reviews took 3+ days (Behavior), which blocked other developers and delayed our release by a week (Impact). How can I support you in prioritizing reviews?' This approach focuses on behavior, not personality, and invites collaboration. They shared they were overwhelmed with their own tasks, so we agreed on a team rotation for urgent reviews. PR turnaround dropped to <1 day, and our relationship actually strengthened because I approached it constructively, not accusatorily.", explanation: "Being 'direct' can sound harsh. The strong answer shows a structured, empathetic approach with results.", tip: "Focus on observable behaviors and their impact, not personality or intent. Always offer to help." },
      { question: "Explain a complex project to a non-technical audience.", difficulty: "Hard", weak: "I built a microservices architecture for our platform.", strong: "I'd explain it like this: 'Our old system was like a single restaurant kitchen serving 1000 customers — one problem could shut down everything. We rebuilt it as a food court with specialized stations: pizza, burgers, salads. Now if the pizza station has an issue, burgers still serve customers. Each station can scale independently during rush hour. For the business, this means: 99.9% uptime (we used to have monthly outages), faster feature launches (teams work independently), and we can handle Black Friday traffic without crashing. The tradeoff was 6 months of engineering time, but we've already saved $200K in lost revenue from downtime.' This connects architecture to business outcomes they care about: reliability, speed, and cost.", explanation: "Jargon without context loses people. The strong answer uses metaphors and translates tech to business value.", tip: "Always end technical explanations with 'What this means for [audience]' — revenue, customers, time saved." },
      { question: "How do you ensure your written communication is clear?", difficulty: "Easy", weak: "I proofread my emails before sending.", strong: "I follow a few principles: (1) Front-load the main point — busy executives read the first sentence and skim. (2) Use formatting — bullets, bold, headings — to make it scannable. (3) Anticipate questions — if I'm proposing something, I include 'Why now,' 'Alternatives considered,' and 'Next steps.' (4) For complex topics, I write a TL;DR at the top. For example, when proposing a database migration, my doc opened with: 'TL;DR: Migrate from MySQL to PostgreSQL by Q2. Benefits: 40% faster queries, $3K/month cost savings. Risk: 2 days downtime during migration. Mitigation: Blue-green deployment.' Stakeholders knew the decision points instantly. This reduced back-and-forth emails by ~60% and sped up decision-making.", explanation: "Proofreading is basic. The strong answer shows strategic communication that respects reader time and drives action.", tip: "Write for skimmers. Most people won't read every word — make the key points obvious." }
    ],
    "Body Language & Confidence": [
      { question: "How do you project confidence in high-pressure situations?", difficulty: "Medium", weak: "I stay calm and act confident even when nervous.", strong: "I use three techniques: (1) Body language — I sit up straight, maintain eye contact, and avoid fidgeting. Before interviews or presentations, I do power poses for 2 minutes (research shows it actually reduces cortisol). (2) Vocal control — I slow down my speaking pace deliberately, which projects calm and gives me time to think. When I catch myself speaking fast due to nerves, I pause, breathe, and reset my pace. (3) Preparation as confidence — I over-prepare for high-stakes situations. For example, before presenting to executives, I rehearse out loud 3 times, anticipate tough questions, and prepare concise answers. During a recent board presentation, an executive challenged our timeline — because I'd anticipated this, I calmly walked through our risk mitigation plan and dependencies. Confidence isn't about not feeling nervous; it's about managing nervous energy productively.", explanation: "Generic 'stay calm' is weak. The strong answer gives specific, actionable techniques with real examples.", tip: "Physical techniques (breathing, posture, pacing) are trainable skills. Practice them before high-stakes moments." },
      { question: "Describe a time you had to present bad news to stakeholders.", difficulty: "Hard", weak: "I told them honestly that we missed the deadline and apologized.", strong: "Our API integration project was 2 weeks behind schedule, risking a $100K partnership deal. I scheduled a stakeholder meeting within 24 hours. I opened with: 'We're 2 weeks behind. I want to share why, what we're doing, and when we'll be ready.' I maintained steady eye contact, used a confident tone despite being nervous, and avoided defensive body language. I explained the technical blockers clearly (third-party API instability), our mitigation plan (direct vendor escalation + parallel workaround), and the new realistic timeline (3 weeks with buffer). I then paused, invited questions, and addressed concerns calmly. The key: I owned the problem without making excuses, presented a clear plan, and showed I was in control. The stakeholders appreciated the transparency, and we preserved the partnership. I learned that delivering bad news confidently is about clarity, accountability, and demonstrating you have a path forward.", explanation: "Apologizing without context is weak. The strong answer shows ownership, a plan, and confident delivery despite difficulty.", tip: "Bad news + plan + confidence = trust. Bad news + excuses + nervous delivery = lost credibility." },
      { question: "How do you handle interview stress and anxiety?", difficulty: "Easy", weak: "I take deep breaths and try to relax before interviews.", strong: "I have a pre-interview routine: (1) Research the company and interviewers on LinkedIn — familiarity reduces anxiety. (2) The night before, I write down 3 accomplishments I'm proud of to remind myself of my value. (3) On interview day, I arrive 10 minutes early, find a quiet spot, and do box breathing (4 seconds in, hold 4, out 4, hold 4) for 2 minutes — this activates the parasympathetic nervous system and calms nerves. (4) I reframe: 'This is a conversation, not an interrogation. They need to fill a role; I'm evaluating if it's a fit.' (5) I focus on listening actively rather than worrying about my next answer — this reduces self-consciousness. During one stressful interview, my mind blanked on a question. Instead of panicking, I said, 'Great question — let me take 5 seconds to think through this clearly.' That pause reset my nerves and I delivered a strong answer. Stress is normal; managing it is a skill.", explanation: "Basic relaxation is a start, but the strong answer shows a systematic, evidence-based approach with a real example.", tip: "It's okay to pause and think before answering. Silence is less awkward than rambling. Say: 'Let me think about this for a moment.'" }
    ]
  };

  const questions = baseQuestions[category as keyof typeof baseQuestions] || baseQuestions["HR & Behavioral"];
  
  return questions.map((q, i) => ({
    id: Date.now() + i,
    category,
    ...q
  }));
}

// ── Generate 50 questions ─────────────────────────────────────────────────────
async function generateQuestions(career: string, category: string) {
  const careerLabel = CAREER_LABELS[career] ?? career;
  const sectionDesc = SECTION_DESCRIPTIONS[category] ?? category;

  const prompt = `Generate exactly 50 unique interview questions for a ${careerLabel} in the "${category}" section covering ${sectionDesc}.

CRITICAL: Return ONLY a valid JSON array with exactly 50 objects. Each must have:
- "question": the interview question (unique, no duplicates)
- "difficulty": "Easy" (15 questions), "Medium" (25 questions), or "Hard" (10 questions)
- "weak": a poor example answer (2-3 sentences)
- "strong": an excellent detailed answer with specific ${careerLabel} examples (4-6 sentences)
- "explanation": why weak fails and strong works (2 sentences)
- "tip": one actionable tip (1 sentence)

Requirements:
1. Mix difficulty levels: 15 Easy, 25 Medium, 10 Hard
2. Ensure all 50 questions are strictly relevant to ${careerLabel}
3. Include diverse scenarios (common, edge cases, advanced topics)
4. Return raw JSON array only — NO markdown, NO explanatory text, JUST the array

Format: [{"question":"...","difficulty":"...","weak":"...","strong":"...","explanation":"...","tip":"..."},...]`;

  const raw = await callGemini(
    [{ role: "user", parts: [{ text: prompt }] }],
    16384 // Increased token limit for 50 questions
  );

  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let questions;
  try {
    
    questions = JSON.parse(cleaned);
    if (!Array.isArray(questions)) {
      throw new Error("Response is not an array");
    }
    if (questions.length === 0) {
      throw new Error("Response array is empty");
    }
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    // Try to extract JSON array from response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Could not parse questions JSON from Gemini response. Response: " + cleaned.substring(0, 200));
    try {
      questions = JSON.parse(match[0]);
    } catch {
      throw new Error("Failed to parse extracted JSON array");
    }
  }

  // Validate structure
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`Expected array of questions, got: ${typeof questions}`);
  }

  return questions.map((q: Record<string, string>, i: number) => ({
    id: Date.now() + i,
    category,
    question: q.question || "",
    difficulty: q.difficulty || "Medium",
    weak: q.weak || "",
    strong: q.strong || "",
    explanation: q.explanation || "",
    tip: q.tip || "",
  }));
}

export async function POST(req: NextRequest) {
  try {
    // ── Body size guard (prevent large payload attacks) ──────────────────────
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 50_000) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }

    const body = await req.json();

    // ── Mode: generate questions ──
    if (body.mode === "generateQuestions") {
      const career = typeof body.career === "string" ? body.career.slice(0, 100) : "";
      const category = typeof body.category === "string" ? body.category.slice(0, 100) : "";
      if (!career || !category) {
        return NextResponse.json({ error: "career and category are required" }, { status: 400 });
      }
      try {
        const questions = await generateQuestions(career, category);
        return NextResponse.json({ questions });
      } catch (genError) {
        console.error("❌ Question generation error:", genError instanceof Error ? genError.message : String(genError));
        
        // Check if it's a billing error
        const errorMessage = genError instanceof Error ? genError.message : "Unknown error";
        const isBillingError = errorMessage.includes("403") || errorMessage.includes("billing");
        
        if (isBillingError) {
          // Return fallback static questions instead of error
          console.log("⚠️  Billing not enabled - returning fallback questions");
          const fallbackQuestions = generateFallbackQuestions(career, category);
          return NextResponse.json({ 
            questions: fallbackQuestions,
            warning: "Using sample questions. Enable Gemini API billing for AI-generated questions."
          });
        }
        
        let helpfulMessage = "Failed to generate questions. ";
        const isQuotaError = errorMessage.includes("429") || errorMessage.includes("quota");
        
        if (isQuotaError) {
          helpfulMessage += "API quota exceeded. Wait a few minutes or upgrade your Gemini API plan.";
        } else {
          helpfulMessage += "Please check: 1) GEMINI_API_KEY in .env.local is valid 2) Internet connection 3) Console logs for details.";
        }
        
        return NextResponse.json({ 
          error: helpfulMessage,
          details: errorMessage,
          troubleshooting: [
            "Check browser console (F12) for detailed error logs",
            "Verify GEMINI_API_KEY in .env.local",
            "Enable billing: https://console.cloud.google.com/billing",
            "Get a new key: https://aistudio.google.com/app/apikey"
          ]
        }, { status: 500 });
      }
    }

    // ── Mode: chat ──
    const { messages, companionId, context } = body;

    // Validate messages array
    if (!Array.isArray(messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }
    if (messages.length > 50) {
      return NextResponse.json({ error: "Too many messages in history" }, { status: 400 });
    }

    const safeCompanionId = typeof companionId === "string" ? companionId.slice(0, 50) : "luna";
    const safeContext = typeof context === "string" ? context.slice(0, 500) : "";

    const persona = COMPANION_PERSONAS[safeCompanionId ?? "luna"] ?? COMPANION_PERSONAS.luna;
    const systemText = [DEFAULT_SYSTEM, persona, safeContext ? `Context: ${safeContext}` : ""]
      .filter(Boolean).join("\n\n");

    // Build contents — inject system prompt into first user message for compatibility
    const filtered = messages.filter(
      (m: { role: string; content: string }) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    ).map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content.slice(0, 4000), // cap each message at 4k chars
    }));

    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (filtered.length === 0) {
      contents.push({ role: "user", parts: [{ text: systemText + "\n\nHello" }] });
    } else {
      // Inject system into the very first user message
      contents.push({
        role: "user",
        parts: [{ text: systemText + "\n\n---\n\n" + filtered[0].content }],
      });
      for (let i = 1; i < filtered.length; i++) {
        contents.push({
          role: filtered[i].role === "assistant" ? "model" : "user",
          parts: [{ text: filtered[i].content }],
        });
      }
    }

    const message = await callGemini(contents, 1024);
    return NextResponse.json({ message });

  } catch (error) {
    console.error("/api/chat error:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", error);
    // Return a generic message — never expose internal error details
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

