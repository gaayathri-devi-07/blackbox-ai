import type { Difficulty, PracticeCategory, TargetRole } from "../../lib/generated/prisma/enums";

export interface SeedQuestion {
  /** Stable key — changing it creates a new row instead of updating. */
  slug: string;
  category: PracticeCategory;
  /** Empty array = shown to every track. */
  roleTargets: TargetRole[];
  difficulty: Difficulty;
  question: string;
  sampleAnswer: string;
  weakAnswer?: string;
  explanation?: string;
  tip?: string;
  /** 3–4 short concepts to study; shown in results and used by the interviewer to coach. */
  keyPoints?: string[];
  tags: string[];
}

/** Compact authoring format for the question bank (see prisma/seed-data/bank/). */
export interface BankItem {
  slug: string;
  /** Easy, medium or hard. */
  d: "E" | "M" | "H";
  /** Overrides the file's default target tracks. Empty array = every track. */
  roles?: TargetRole[];
  q: string;
  /** A strong spoken answer. */
  a: string;
  /** 3–4 concepts a strong answer must cover. */
  k: string[];
  /** A typical weak answer, for contrast. */
  w?: string;
  /** Why the strong answer is strong. */
  e?: string;
  t?: string;
  tags?: string[];
}

const DIFFICULTY = { E: "EASY", M: "MEDIUM", H: "HARD" } as const;

export function bank(category: PracticeCategory, roles: TargetRole[], items: BankItem[]): SeedQuestion[] {
  return items.map((i) => ({
    slug: i.slug,
    category,
    roleTargets: i.roles ?? roles,
    difficulty: DIFFICULTY[i.d],
    question: i.q,
    sampleAnswer: i.a,
    weakAnswer: i.w,
    explanation: i.e,
    tip: i.t,
    keyPoints: i.k,
    tags: i.tags ?? i.slug.split("-").filter((w) => w.length > 2).slice(0, 4),
  }));
}
