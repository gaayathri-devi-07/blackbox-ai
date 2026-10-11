import type { PracticeCategory, TargetRole } from "@/lib/generated/prisma/enums";

/**
 * Curated study notes for retrieval. Each section becomes one retrievable
 * chunk, so sections are written to stand on their own: what the concept is,
 * what interviewers listen for, and the common mistake.
 *
 * Add a note here and run `npm run rag:ingest` (or restart `npm run dev`).
 */
export interface KnowledgeNote {
  id: string;
  title: string;
  category?: PracticeCategory;
  roles?: TargetRole[];
  tags: string[];
  sections: { heading: string; body: string }[];
}

export const KNOWLEDGE_NOTES: KnowledgeNote[] = [
  {
    id: "star-method",
    title: "Answering behavioral questions with STAR",
    category: "BEHAVIORAL",
    tags: ["behavioral", "star", "storytelling", "hr round"],
    sections: [
      {
        heading: "The structure",
        body: "Situation (one or two sentences of context), Task (what you specifically owned), Action (the steps you took, in first person, with the reasoning), Result (a measurable outcome and what you learned). Spend most of the time on Action; interviewers score ownership and judgement, not the backstory.",
      },
      {
        heading: "What interviewers listen for",
        body: "Say 'I', not 'we', for your own contribution. Name one trade-off you weighed or one disagreement you resolved. Quantify the result (time saved, error rate, users, revenue) or, if you cannot, describe the observable change. Close with a lesson you applied later.",
      },
      {
        heading: "Common mistakes",
        body: "Spending a minute on context, describing what the team did, ending without a result, or picking a story where nothing went wrong. Prepare six stories (conflict, failure, leadership, ambiguity, tight deadline, learning something fast) and map each to several questions.",
      },
    ],
  },
  {
    id: "tell-me-about-yourself",
    title: "Tell me about yourself",
    category: "COMMUNICATION",
    tags: ["introduction", "hr round", "pitch", "campus placement"],
    sections: [
      {
        heading: "A ninety-second structure",
        body: "Present (who you are and what you work on now), past (two experiences that map directly to this role, each with one concrete result), future (why this role and company are the logical next step). Students can use a project, internship or competition in place of work experience.",
      },
      {
        heading: "Common mistakes",
        body: "Reciting the résumé in order, listing personal details like hometown and hobbies first, or running past two minutes. End with a hook the interviewer can follow up on, such as the project you are proudest of.",
      },
    ],
  },
  {
    id: "system-design-approach",
    title: "A repeatable approach to system design interviews",
    category: "SYSTEM_DESIGN",
    roles: ["BACKEND_ARCHITECT", "FULL_STACK_DEVELOPER", "AI_ENGINEER", "ML_ENGINEER"],
    tags: ["system design", "scalability", "framework", "requirements"],
    sections: [
      {
        heading: "Clarify requirements first",
        body: "Spend the first five minutes on functional requirements (what the system must do), non-functional requirements (latency, availability, consistency, durability) and scale (daily active users, reads per second versus writes per second, data size per year). Write the numbers down; they justify every later decision.",
      },
      {
        heading: "High-level design, then deep dives",
        body: "Draw clients, load balancer, stateless services, data stores, caches and queues. Define the main APIs and the data model. Then go deep on the hardest part the interviewer cares about: hot keys, fan-out, consistency, or failure handling. Always state the trade-off you chose and the alternative you rejected.",
      },
      {
        heading: "Signals of seniority",
        body: "Back-of-the-envelope estimates, identifying the bottleneck before optimising, discussing failure modes (what happens when a node, region or dependency dies), observability (metrics, logs, traces, alerts) and how the design evolves as traffic grows tenfold.",
      },
    ],
  },
  {
    id: "caching-consistency",
    title: "Caching, consistency and the CAP trade-off",
    category: "SYSTEM_DESIGN",
    roles: ["BACKEND_ARCHITECT", "FULL_STACK_DEVELOPER"],
    tags: ["cache", "redis", "consistency", "cap theorem", "invalidation"],
    sections: [
      {
        heading: "Cache patterns",
        body: "Cache-aside (application reads cache, falls back to the database, then populates the cache) is the default. Write-through keeps cache and store in sync at write time; write-back defers writes for speed at the risk of loss. Set TTLs, and protect against stampedes with request coalescing or jittered expiry.",
      },
      {
        heading: "Consistency choices",
        body: "During a network partition a distributed store must choose between consistency and availability (CAP). Strong consistency suits balances and inventory; eventual consistency suits feeds, counters and recommendations. Mention read-your-writes guarantees and idempotent writes with request keys.",
      },
    ],
  },
  {
    id: "rag-systems",
    title: "Designing retrieval-augmented generation (RAG) systems",
    category: "LLM_ARCHITECTURES",
    roles: ["AI_ENGINEER", "ML_ENGINEER"],
    tags: ["rag", "retrieval", "embeddings", "vector database", "chunking", "llm"],
    sections: [
      {
        heading: "The pipeline",
        body: "Ingest documents, split them into chunks (by structure first, then size, typically 200 to 800 tokens with overlap), embed each chunk, and store vectors with metadata. At query time embed the question, retrieve top-k by similarity, optionally re-rank with a cross-encoder, and put the passages in the prompt with instructions to answer only from them and cite sources.",
      },
      {
        heading: "Hybrid retrieval",
        body: "Dense vectors capture meaning but miss exact identifiers, error codes and rare terms; keyword search (BM25 or Postgres full-text) catches those. Combine both and fuse rankings with reciprocal rank fusion. Filter by metadata (tenant, product, date) before ranking to avoid leaking or stale context.",
      },
      {
        heading: "Evaluating RAG",
        body: "Measure retrieval separately from generation: recall@k and mean reciprocal rank on a golden set of questions with known relevant passages; then answer faithfulness (is every claim supported by the retrieved text), answer relevance and citation accuracy. Track these on every change to chunking, embeddings or prompts.",
      },
      {
        heading: "Common failure modes",
        body: "Chunks that cut a table or a definition in half, embeddings from a different model than the index, top-k too small for multi-part questions, no 'I don't know' path when nothing relevant is retrieved, and prompt injection hidden inside retrieved documents.",
      },
    ],
  },
  {
    id: "llm-evaluation",
    title: "Evaluating LLM applications",
    category: "LLM_ARCHITECTURES",
    roles: ["AI_ENGINEER", "ML_ENGINEER", "DATA_SCIENTIST"],
    tags: ["evals", "llm-as-judge", "golden dataset", "langsmith", "regression testing"],
    sections: [
      {
        heading: "Build a golden dataset",
        body: "Collect 50 to 200 realistic inputs with reference outputs or grading rubrics, including edge cases and known past failures. Version it. Every prompt, model or retrieval change runs against it before release, like a unit test suite for behaviour.",
      },
      {
        heading: "Kinds of evaluators",
        body: "Deterministic checks (valid JSON, required fields, length, banned content), reference-based metrics (exact match, semantic similarity), and model-graded rubrics (an LLM judge scoring faithfulness or helpfulness, calibrated against human labels). Track cost and latency alongside quality.",
      },
      {
        heading: "Online monitoring",
        body: "Trace production calls, sample them for review, collect user feedback, and alert on drift in scores, refusal rate or latency. Tools such as LangSmith store traces, datasets and experiment comparisons in one place.",
      },
    ],
  },
  {
    id: "agents-tool-use",
    title: "LLM agents and tool use",
    category: "LLM_ARCHITECTURES",
    roles: ["AI_ENGINEER"],
    tags: ["agents", "tool calling", "function calling", "planning", "guardrails"],
    sections: [
      {
        heading: "How an agent loop works",
        body: "The model receives a goal and a list of tools with JSON schemas. Each step it either calls a tool (the application executes it and returns the result) or answers. The loop ends on a final answer or a step budget. Keep tools small, deterministic and well described; the description is the model's only documentation.",
      },
      {
        heading: "Making agents safe and reliable",
        body: "Bound the number of steps and the cost, validate every tool argument, give read-only tools by default and require confirmation for side effects, log every tool call for audit, and provide a deterministic fallback path when the model is unavailable. Evaluate agents on task success, number of steps and tool-call accuracy.",
      },
    ],
  },
  {
    id: "ml-bias-variance",
    title: "Bias, variance and debugging a model",
    category: "MACHINE_LEARNING",
    roles: ["ML_ENGINEER", "DATA_SCIENTIST", "AI_ENGINEER"],
    tags: ["overfitting", "underfitting", "regularization", "learning curves", "validation"],
    sections: [
      {
        heading: "Diagnosing with learning curves",
        body: "High training error and high validation error means high bias (underfitting): use a richer model or better features. Low training error but high validation error means high variance (overfitting): add data, regularise (L2, dropout, early stopping), or simplify. Always check for leakage when validation looks too good.",
      },
      {
        heading: "A debugging order that works",
        body: "Verify the data and labels, overfit a tiny batch to prove the pipeline can learn, compare against a simple baseline, then tune. Slice errors by segment to find where the model fails rather than looking only at the aggregate metric.",
      },
    ],
  },
  {
    id: "classification-metrics",
    title: "Choosing classification metrics",
    category: "MACHINE_LEARNING",
    roles: ["ML_ENGINEER", "DATA_SCIENTIST"],
    tags: ["precision", "recall", "f1", "roc auc", "imbalanced data"],
    sections: [
      {
        heading: "Precision, recall and thresholds",
        body: "Precision is the share of predicted positives that are correct; recall is the share of actual positives that were found. Fraud and disease screening favour recall; spam filtering favours precision. The threshold sets the trade-off, so choose it from the business cost of each error, not by default at 0.5.",
      },
      {
        heading: "Imbalanced data",
        body: "Accuracy is misleading when positives are rare. Use precision-recall AUC, F1 or recall at a fixed precision, stratified splits, class weights or resampling, and calibrate probabilities if they drive decisions.",
      },
    ],
  },
  {
    id: "mlops-monitoring",
    title: "Deploying and monitoring models in production",
    category: "MLOPS",
    roles: ["ML_ENGINEER", "AI_ENGINEER"],
    tags: ["mlops", "drift", "monitoring", "deployment", "feature store", "canary"],
    sections: [
      {
        heading: "Safe rollout",
        body: "Version data, code and model together. Ship behind a shadow deployment or canary, compare online metrics to the current model, and keep one-click rollback. Make training and serving use the same feature code to avoid training-serving skew.",
      },
      {
        heading: "What to monitor",
        body: "Input data drift (feature distributions), prediction drift, model quality once labels arrive, latency and error rates, and business KPIs. Alert on sustained shifts and define a retraining trigger and owner.",
      },
    ],
  },
  {
    id: "dsa-problem-solving",
    title: "Solving coding problems out loud",
    category: "DATA_STRUCTURES",
    tags: ["coding interview", "data structures", "algorithms", "complexity", "problem solving"],
    sections: [
      {
        heading: "A dependable sequence",
        body: "Restate the problem and confirm input sizes and edge cases. Give a brute-force solution with its time and space complexity. Find the bottleneck and choose a data structure that removes it (hash map for lookups, heap for top-k, two pointers for sorted arrays, BFS for shortest path in unweighted graphs). Code it, then walk a test case and edge cases by hand.",
      },
      {
        heading: "What interviewers score",
        body: "Communication while thinking, correct complexity analysis, clean code with meaningful names, and testing without being asked. Getting stuck silently costs more than an imperfect solution explained clearly.",
      },
    ],
  },
  {
    id: "api-design",
    title: "Designing clean APIs",
    category: "BACKEND_ENGINEERING",
    roles: ["BACKEND_ARCHITECT", "FULL_STACK_DEVELOPER"],
    tags: ["rest", "api design", "idempotency", "pagination", "versioning", "authentication"],
    sections: [
      {
        heading: "Principles",
        body: "Model resources with nouns and use HTTP methods for actions; return precise status codes; paginate lists with cursors; make retries safe with idempotency keys; version breaking changes; validate input at the boundary and return structured errors with a request id.",
      },
      {
        heading: "Security basics",
        body: "Authenticate every request (short-lived tokens), authorise per resource, rate-limit by user and IP, never log secrets or personal data, and use HTTPS everywhere.",
      },
    ],
  },
  {
    id: "frontend-performance",
    title: "Frontend performance and rendering",
    category: "FRONTEND_ENGINEERING",
    roles: ["FULL_STACK_DEVELOPER"],
    tags: ["web vitals", "rendering", "react", "performance", "accessibility"],
    sections: [
      {
        heading: "Core Web Vitals",
        body: "Largest Contentful Paint (load speed: optimise images, server rendering, critical CSS), Interaction to Next Paint (responsiveness: avoid long tasks, split work, defer non-critical JavaScript) and Cumulative Layout Shift (stability: reserve space for media and fonts).",
      },
      {
        heading: "Rendering strategies",
        body: "Static generation for content that rarely changes, server rendering for personalised or fresh pages, client rendering for highly interactive parts, and streaming to show content progressively. Measure before optimising, with real-user monitoring where possible.",
      },
    ],
  },
  {
    id: "ab-testing",
    title: "Designing A/B tests",
    category: "DATA_ANALYTICS",
    roles: ["DATA_SCIENTIST"],
    tags: ["experimentation", "a/b testing", "statistics", "power", "p-value"],
    sections: [
      {
        heading: "Before launching",
        body: "Define one primary metric and guardrail metrics, the minimum detectable effect, and the sample size from a power calculation. Randomise at the right unit (user, session, cluster) and pre-register the analysis so you are not tempted to stop early when the result looks good.",
      },
      {
        heading: "Reading results",
        body: "Report the effect size with a confidence interval, not just a p-value. Check for sample ratio mismatch, novelty effects and segment differences. Peeking repeatedly inflates false positives unless you use sequential testing.",
      },
    ],
  },
  {
    id: "gd-entering-and-structuring",
    title: "Group discussions: entering, structuring and summarising",
    category: "COMMUNICATION",
    tags: ["group discussion", "gd", "campus placement", "leadership", "listening"],
    sections: [
      {
        heading: "Opening and entering",
        body: "If you open, define the topic and propose two or three angles to discuss; that frames the whole discussion. To enter a busy discussion, wait for a sentence to end, acknowledge the previous speaker by name ('Building on Maya's point…'), then add one new idea with an example or a number.",
      },
      {
        heading: "What evaluators score",
        body: "Content (relevant, specific points), communication (clear, concise, audible), listening (building on others, not repeating), leadership (bringing the group back on track, inviting quiet members) and composure. Talking the most is not the goal; contributing the most useful points is.",
      },
      {
        heading: "Summarising",
        body: "In the closing summary, neutrally restate the main arguments on each side and where the group converged, without adding new points or declaring a winner. A crisp 30-second summary is often the strongest signal in the round.",
      },
    ],
  },
  {
    id: "gd-handling-conflict",
    title: "Group discussions: disagreeing and handling dominant speakers",
    category: "COMMUNICATION",
    tags: ["group discussion", "gd", "disagreement", "assertiveness"],
    sections: [
      {
        heading: "Disagreeing well",
        body: "Disagree with the idea, not the person: 'I see it differently, because…' followed by evidence. Concede a fair point before countering; it signals maturity and makes your counterpoint more persuasive.",
      },
      {
        heading: "When someone dominates",
        body: "Do not raise your voice. Use a short bridging phrase at a natural pause ('If I can add one point here…'), make it quickly, and hand the floor to someone who has not spoken. Evaluators reward the person who restores balance.",
      },
    ],
  },
  {
    id: "handling-unknown-questions",
    title: "When you don't know the answer",
    category: "COMMUNICATION",
    tags: ["interview strategy", "honesty", "problem solving", "nerves"],
    sections: [
      {
        heading: "What to do",
        body: "Say so briefly and honestly, then reason from what you do know: 'I haven't used that directly, but here is how I would approach it.' Ask a clarifying question, state your assumptions, and work toward a partial answer. Interviewers value calm reasoning more than a memorised definition.",
      },
      {
        heading: "Managing nerves",
        body: "Pause and breathe before answering; a two-second silence reads as thoughtful. Structure the answer out loud ('There are three parts to this'), which buys time and keeps you organised.",
      },
    ],
  },
  {
    id: "salary-and-closing",
    title: "Closing the interview: questions to ask and next steps",
    category: "BEHAVIORAL",
    tags: ["questions for interviewer", "closing", "hr round", "negotiation"],
    sections: [
      {
        heading: "Good questions to ask",
        body: "Ask about the team's biggest challenge this year, how success is measured in the first six months, how decisions are made, and what the interviewer enjoys about the work. Avoid questions answered on the careers page.",
      },
      {
        heading: "Compensation conversations",
        body: "Research the market range for the role and location first. If asked early, give a range based on research and say you are focused on fit. Negotiate after an offer, politely and with data, considering the whole package.",
      },
    ],
  },
];
