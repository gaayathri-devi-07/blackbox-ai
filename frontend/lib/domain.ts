/**
 * Shared domain vocabulary — safe to import from client and server code.
 * Enum values come from the Prisma schema so the UI, API validation and the
 * database can never drift apart.
 */
import {
  CareerStage,
  Difficulty,
  ExperienceLevel,
  InterviewMode,
  InterviewTimeline,
  PracticeCategory,
  TargetRole,
} from "@/lib/generated/prisma/enums";

export { CareerStage, Difficulty, ExperienceLevel, InterviewMode, InterviewTimeline, PracticeCategory, TargetRole };

export const TARGET_ROLES = Object.values(TargetRole);
export const EXPERIENCE_LEVELS = Object.values(ExperienceLevel);
export const PRACTICE_CATEGORIES = Object.values(PracticeCategory);
export const DIFFICULTIES = Object.values(Difficulty);
export const INTERVIEW_MODES = Object.values(InterviewMode);
export const CAREER_STAGES = Object.values(CareerStage);
export const INTERVIEW_TIMELINES = Object.values(InterviewTimeline);

// ─── Career profile ───────────────────────────────────────────────────────────

export const CAREER_STAGE_LABELS: Record<
  CareerStage,
  { label: string; detail: string; organization: string; title: string; titlePlaceholder: string; suggestedLevel: ExperienceLevel }
> = {
  STUDENT: {
    label: "Student",
    detail: "Preparing for internships or campus placements",
    organization: "College or university",
    title: "Degree and major",
    titlePlaceholder: "B.Tech, Computer Science",
    suggestedLevel: "ENTRY",
  },
  RECENT_GRADUATE: {
    label: "Recent graduate",
    detail: "Graduated in the last two years",
    organization: "College or university",
    title: "Degree and major",
    titlePlaceholder: "B.E., Information Technology",
    suggestedLevel: "ENTRY",
  },
  WORKING_PROFESSIONAL: {
    label: "Working professional",
    detail: "Looking for the next role",
    organization: "Current company",
    title: "Current job title",
    titlePlaceholder: "Software Engineer II",
    suggestedLevel: "MID",
  },
  CAREER_SWITCHER: {
    label: "Career switcher",
    detail: "Moving into tech or a new specialisation",
    organization: "Current or last company",
    title: "Current role",
    titlePlaceholder: "Data Analyst",
    suggestedLevel: "JUNIOR",
  },
  BETWEEN_JOBS: {
    label: "Between jobs",
    detail: "Actively searching after a break or layoff",
    organization: "Most recent company",
    title: "Most recent job title",
    titlePlaceholder: "Backend Developer",
    suggestedLevel: "MID",
  },
};

export const TIMELINE_LABELS: Record<InterviewTimeline, { label: string; detail: string }> = {
  THIS_WEEK: { label: "This week", detail: "Interviews already scheduled" },
  WITHIN_MONTH: { label: "Within a month", detail: "Applications in progress" },
  ONE_TO_THREE_MONTHS: { label: "1–3 months", detail: "Building up steadily" },
  EXPLORING: { label: "Just exploring", detail: "No fixed date yet" },
};

/** Companies offered as quick picks for target companies. */
export const POPULAR_COMPANIES = [
  "Google",
  "Microsoft",
  "Amazon",
  "Meta",
  "Apple",
  "Atlassian",
  "Adobe",
  "Salesforce",
  "Flipkart",
  "Uber",
  "Swiggy",
  "Zomato",
  "Razorpay",
  "PhonePe",
  "Infosys",
  "TCS",
  "Startups",
];

// ─── Practice categories ──────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<PracticeCategory, string> = {
  LLM_ARCHITECTURES: "LLM Architectures",
  MACHINE_LEARNING: "ML Fundamentals",
  MLOPS: "MLOps",
  SYSTEM_DESIGN: "System Design",
  DATA_STRUCTURES: "Data Structures & Algorithms",
  BACKEND_ENGINEERING: "Backend Engineering",
  FRONTEND_ENGINEERING: "Frontend Engineering",
  DATA_ANALYTICS: "Statistics & Analytics",
  BEHAVIORAL: "Behavioral",
  COMMUNICATION: "Communication",
};

export const CATEGORY_DESCRIPTIONS: Record<PracticeCategory, string> = {
  LLM_ARCHITECTURES: "Transformers, retrieval, fine-tuning, inference and evaluation of large language models.",
  MACHINE_LEARNING: "Learning theory, model selection, optimization and the failure modes that interviews probe.",
  MLOPS: "Training pipelines, feature stores, deployment, monitoring and drift in production ML.",
  SYSTEM_DESIGN: "Distributed systems, scalability, consistency and the trade-offs behind them.",
  DATA_STRUCTURES: "Complexity analysis and the core structures and algorithms behind coding rounds.",
  BACKEND_ENGINEERING: "APIs, databases, concurrency, caching and service reliability.",
  FRONTEND_ENGINEERING: "Rendering, state, performance and accessibility in modern web applications.",
  DATA_ANALYTICS: "Statistical inference, experimentation, metrics and SQL analysis.",
  BEHAVIORAL: "Ownership, conflict, failure and judgment — told with structure and evidence.",
  COMMUNICATION: "Explaining complex work clearly to engineers, leaders and stakeholders.",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Foundational",
  MEDIUM: "Intermediate",
  HARD: "Advanced",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, { label: string; detail: string }> = {
  ENTRY: { label: "Entry level", detail: "0–1 years · graduates and career switchers" },
  JUNIOR: { label: "Junior", detail: "1–3 years of professional experience" },
  MID: { label: "Mid-level", detail: "3–5 years · independent ownership" },
  SENIOR: { label: "Senior", detail: "5–8 years · technical leadership" },
  STAFF: { label: "Staff and above", detail: "8+ years · cross-team architecture" },
};

export const MODE_LABELS: Record<InterviewMode, { label: string; detail: string }> = {
  SUPPORTIVE: { label: "Coached", detail: "Feedback and a model answer after every response." },
  STANDARD: { label: "Standard", detail: "A realistic loop with follow-ups. Feedback at the end." },
  PRESSURE: { label: "Bar raiser", detail: "Probing follow-ups and challenged assumptions." },
};

// ─── Target tracks ────────────────────────────────────────────────────────────

export type ModuleId = "practice" | "interview" | "gd" | "project" | "performance";

export interface TrackConfig {
  label: string;
  /** One-line positioning shown in onboarding and the dashboard header. */
  summary: string;
  /** Practice domains weighted for this track, most important first. */
  focusCategories: PracticeCategory[];
  /** Competencies plotted on the dashboard and emphasised in evaluations. */
  competencies: string[];
  /** Injected into interviewer prompts so questions match the track. */
  interviewFocus: string;
  /** Dashboard module order for this track. */
  moduleOrder: ModuleId[];
}

export const TRACKS: Record<TargetRole, TrackConfig> = {
  AI_ENGINEER: {
    label: "AI Engineer",
    summary: "LLM applications, retrieval systems, evaluation and production AI.",
    focusCategories: ["LLM_ARCHITECTURES", "SYSTEM_DESIGN", "MLOPS", "MACHINE_LEARNING", "BEHAVIORAL"],
    competencies: ["LLM systems", "Retrieval & grounding", "Evaluation rigor", "Production reliability", "Communication"],
    interviewFocus:
      "LLM application architecture, retrieval-augmented generation, prompt and tool design, evaluation methodology, latency and cost trade-offs, guardrails, and operating generative models in production.",
    moduleOrder: ["interview", "practice", "project", "gd", "performance"],
  },
  ML_ENGINEER: {
    label: "ML Engineer",
    summary: "Model development, training infrastructure and ML in production.",
    focusCategories: ["MACHINE_LEARNING", "MLOPS", "LLM_ARCHITECTURES", "DATA_STRUCTURES", "BEHAVIORAL"],
    competencies: ["Modeling depth", "Training at scale", "MLOps", "Coding fluency", "Communication"],
    interviewFocus:
      "machine learning fundamentals, model selection and debugging, feature engineering, distributed training, deployment and monitoring, data and concept drift, and ML system design.",
    moduleOrder: ["practice", "interview", "project", "gd", "performance"],
  },
  BACKEND_ARCHITECT: {
    label: "Backend Architect",
    summary: "Distributed systems, data-intensive services and platform architecture.",
    focusCategories: ["SYSTEM_DESIGN", "BACKEND_ENGINEERING", "DATA_STRUCTURES", "BEHAVIORAL", "COMMUNICATION"],
    competencies: ["System design", "Data modeling", "Reliability", "Coding fluency", "Technical leadership"],
    interviewFocus:
      "distributed system design, consistency and availability trade-offs, data modeling, caching, queues and event-driven architecture, observability, capacity planning, and leading architectural decisions.",
    moduleOrder: ["interview", "practice", "gd", "project", "performance"],
  },
  FULL_STACK_DEVELOPER: {
    label: "Full Stack Developer",
    summary: "End-to-end product engineering across the web stack.",
    focusCategories: ["FRONTEND_ENGINEERING", "BACKEND_ENGINEERING", "SYSTEM_DESIGN", "DATA_STRUCTURES", "BEHAVIORAL"],
    competencies: ["Frontend craft", "API design", "System design", "Coding fluency", "Product sense"],
    interviewFocus:
      "frontend architecture and performance, API and data design, authentication, web security, testing strategy, end-to-end system design for product features, and shipping iteratively.",
    moduleOrder: ["practice", "interview", "project", "gd", "performance"],
  },
  DATA_SCIENTIST: {
    label: "Data Scientist",
    summary: "Statistical inference, experimentation and decision-grade analysis.",
    focusCategories: ["DATA_ANALYTICS", "MACHINE_LEARNING", "COMMUNICATION", "BEHAVIORAL", "MLOPS"],
    competencies: ["Statistics", "Experimentation", "Modeling", "SQL & analysis", "Storytelling"],
    interviewFocus:
      "statistical inference, experiment design and A/B testing, causal reasoning, metric definition, SQL analysis, applied machine learning, and communicating findings to decision makers.",
    moduleOrder: ["practice", "interview", "gd", "project", "performance"],
  },
};

/** "an AI Engineer", "a Data Scientist". */
export function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

export function trackLabel(role: TargetRole | null | undefined): string {
  return role ? TRACKS[role].label : "Unassigned track";
}

// ─── Interview companies ──────────────────────────────────────────────────────

export interface CompanyProfile {
  id: string;
  name: string;
  /** Two-letter monogram rendered in a neutral tile (no brand marks). */
  monogram: string;
  emphasis: string;
  style: string;
  interviewer: { name: string; title: string; voice: "male" | "female" };
}

export const COMPANIES: CompanyProfile[] = [
  {
    id: "google",
    name: "Google",
    monogram: "GO",
    emphasis: "Structured problem solving",
    style: "Collaborative but rigorous. Pushes for optimal solutions, scalability and clear reasoning out loud.",
    interviewer: { name: "Alex Chen", title: "Staff Software Engineer", voice: "male" },
  },
  {
    id: "amazon",
    name: "Amazon",
    monogram: "AM",
    emphasis: "Leadership Principles",
    style: "Behavioral depth on ownership and customer obsession, STAR answers with metrics, bar-raiser follow-ups.",
    interviewer: { name: "Sarah Kim", title: "Principal Engineer", voice: "female" },
  },
  {
    id: "microsoft",
    name: "Microsoft",
    monogram: "MS",
    emphasis: "Growth mindset",
    style: "Technical depth paired with collaboration, learning from failure and pragmatic design decisions.",
    interviewer: { name: "James Wright", title: "Principal Engineering Manager", voice: "male" },
  },
  {
    id: "meta",
    name: "Meta",
    monogram: "ME",
    emphasis: "Scale and impact",
    style: "Product-minded engineering at billions-of-users scale, metric-driven trade-offs and fast execution.",
    interviewer: { name: "Priya Raman", title: "Engineering Manager", voice: "female" },
  },
  {
    id: "ai-lab",
    name: "Frontier AI Lab",
    monogram: "AI",
    emphasis: "Research-grade rigor",
    style: "First-principles depth on models, evaluation and safety; expects precise reasoning about trade-offs.",
    interviewer: { name: "Dr. Maya Patel", title: "Research Engineer", voice: "female" },
  },
  {
    id: "startup",
    name: "Venture-backed Startup",
    monogram: "VS",
    emphasis: "Ownership and velocity",
    style: "Breadth across the stack, ambiguity tolerance, shipping fast and owning outcomes end to end.",
    interviewer: { name: "Jordan Lee", title: "CTO", voice: "male" },
  },
  {
    id: "consulting",
    name: "Technology Consulting",
    monogram: "TC",
    emphasis: "Client-ready communication",
    style: "Structured thinking, stakeholder management and translating technical work into business outcomes.",
    interviewer: { name: "Ryan Thompson", title: "Senior Manager", voice: "male" },
  },
];

export function getCompany(id: string | null | undefined): CompanyProfile {
  return COMPANIES.find((c) => c.id === id) ?? COMPANIES[0];
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

export function scoreBand(score: number | null | undefined): { label: string; tone: "strong" | "steady" | "developing" | "none" } {
  if (score == null) return { label: "Not yet assessed", tone: "none" };
  if (score >= 80) return { label: "Interview ready", tone: "strong" };
  if (score >= 65) return { label: "Approaching bar", tone: "steady" };
  return { label: "Developing", tone: "developing" };
}
