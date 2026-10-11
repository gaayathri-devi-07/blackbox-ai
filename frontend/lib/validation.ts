/**
 * Request schemas shared by API routes (enforcement) and the client (types).
 * Limits here are the single source of truth for payload sizes.
 */
import { z } from "zod";
import {
  CareerStage,
  Difficulty,
  ExperienceLevel,
  InterviewMode,
  InterviewTimeline,
  PracticeCategory,
  TargetRole,
} from "@/lib/generated/prisma/enums";

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid identifier");
const text = (max: number) => z.string().trim().min(1).max(max);

export const targetRoleSchema = z.enum(TargetRole);
export const experienceSchema = z.enum(ExperienceLevel);
export const categorySchema = z.enum(PracticeCategory);
export const difficultySchema = z.enum(Difficulty);
export const modeSchema = z.enum(InterviewMode);
export const careerStageSchema = z.enum(CareerStage);
export const timelineSchema = z.enum(InterviewTimeline);

/** Optional free text: trimmed, empty string clears the field. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    targetRole: targetRoleSchema.optional(),
    experienceLevel: experienceSchema.optional(),
    preferredTopics: z.array(categorySchema).max(10).optional(),
    careerStage: careerStageSchema.nullable().optional(),
    organization: optionalText(120).optional(),
    currentTitle: optionalText(120).optional(),
    graduationYear: z.number().int().min(1970).max(2040).nullable().optional(),
    targetCompanies: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    interviewTimeline: timelineSchema.nullable().optional(),
    goal: optionalText(400).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.");
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

// ─── Practice ─────────────────────────────────────────────────────────────────

export const practiceQuerySchema = z.object({
  category: categorySchema.optional(),
  difficulty: difficultySchema.optional(),
  /** Browse another track's questions without changing the profile. */
  track: targetRoleSchema.optional(),
  /** Exact tag filter, e.g. "rag" or "caching". */
  tag: z.string().trim().toLowerCase().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  scope: z.enum(["track", "all"]).default("track"),
  status: z.enum(["any", "new", "reviewed", "confident"]).default("any"),
  cursor: id.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PracticeQuery = z.infer<typeof practiceQuerySchema>;

export const practiceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("progress"),
    questionId: id,
    status: z.enum(["REVIEWED", "CONFIDENT"]).nullable(),
  }),
  z.object({
    action: z.literal("evaluate"),
    questionId: id,
    answer: text(4000),
  }),
]);

// ─── Coach chat ───────────────────────────────────────────────────────────────

export const chatPostSchema = z.object({
  message: text(4000),
  questionId: id.optional(),
});

export const chatQuerySchema = z.object({
  questionId: id.optional(),
});

// ─── Mock interview ───────────────────────────────────────────────────────────

export const interviewMetricsSchema = z.object({
  /** % of analysed camera time spent looking at the screen. */
  eyeContact: z.number().min(0).max(100).optional(),
  /** % of the time shoulders were visible that the candidate sat upright. */
  posture: z.number().min(0).max(100).optional(),
  smile: z.number().min(0).max(100).optional(),
  /** % of analysed time the face was in frame. */
  facePresence: z.number().min(0).max(100).optional(),
  /** Seconds of camera footage analysed. */
  cameraSec: z.number().int().min(0).max(4 * 60 * 60).optional(),
  fillerWords: z.number().int().min(0).max(10_000).optional(),
});
export type InterviewMetrics = z.infer<typeof interviewMetricsSchema>;

export const interviewActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    company: z.string().trim().min(1).max(40),
    mode: modeSchema,
    experienceLevel: experienceSchema.optional(),
    /** Optional job description to tailor the questions to. */
    jobDescription: z.string().trim().max(8000).optional(),
  }),
  z.object({
    action: z.literal("respond"),
    sessionId: id,
    /** 1-based count of interviewer turns so far (the turn being answered); makes retries idempotent. */
    questionNumber: z.number().int().min(1).max(20),
    answer: text(6000),
    /** True when the answer text came from server-side transcription of the recording. */
    refined: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("complete"),
    sessionId: id,
    metrics: interviewMetricsSchema.default({}),
    durationSec: z.number().int().min(0).max(4 * 60 * 60).optional(),
  }),
]);

export const interviewQuerySchema = z.object({ id: id.optional() });

// ─── Group discussion ─────────────────────────────────────────────────────────

export const gdTranscriptEntrySchema = z.object({
  speakerId: z.string().min(1).max(32),
  speakerName: z.string().min(1).max(60),
  text: z.string().trim().min(1).max(3000),
  at: z.number().int().nonnegative().optional(),
});
export type GDTranscriptEntry = z.infer<typeof gdTranscriptEntrySchema>;

const gdHistory = z.array(gdTranscriptEntrySchema).max(40);

export const gdActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("topic") }),
  z.object({
    action: z.literal("turn"),
    topic: text(300),
    agentId: z.enum(["ai1", "ai2", "ai3", "ai4"]),
    history: gdHistory,
  }),
  z.object({
    action: z.literal("follow_up"),
    topic: text(300),
    history: gdHistory,
  }),
  z.object({
    action: z.literal("complete"),
    topic: text(300),
    transcript: z.array(gdTranscriptEntrySchema).max(200),
    durationSec: z.number().int().min(0).max(4 * 60 * 60).optional(),
  }),
]);

export const gdQuerySchema = z.object({ id: id.optional() });

// ─── Project review ───────────────────────────────────────────────────────────

export const projectActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze"), projectDescription: text(20_000) }),
  z.object({
    action: z.literal("answer"),
    projectDescription: text(20_000),
    question: text(500),
    answer: text(4000),
  }),
]);
