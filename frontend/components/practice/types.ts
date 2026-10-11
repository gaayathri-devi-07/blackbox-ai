import type { Difficulty, PracticeCategory } from "@/lib/domain";

export type PracticeStatus = "REVIEWED" | "CONFIDENT" | null;

export interface PracticeQuestionDTO {
  id: string;
  slug: string;
  category: PracticeCategory;
  roleTargets: string[];
  difficulty: Difficulty;
  question: string;
  sampleAnswer: string;
  weakAnswer: string | null;
  explanation: string | null;
  tip: string | null;
  /** The concepts a strong answer must cover. */
  keyPoints: string[];
  tags: string[];
  status: PracticeStatus;
}
