/**
 * Seed the practice question bank. Idempotent: rows are upserted by slug, so it
 * is safe to run on every deploy (`npm run db:seed`).
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { AI_ML_QUESTIONS } from "./seed-data/ai-ml-questions";
import { ANALYTICS_BEHAVIORAL_QUESTIONS } from "./seed-data/analytics-behavioral-questions";
import { ENGINEERING_QUESTIONS } from "./seed-data/engineering-questions";
import { LEGACY_QUESTIONS } from "./seed-data/legacy-questions";
import { EXISTING_KEY_POINTS } from "./seed-data/existing-key-points";
import { ANALYTICS_BANK } from "./seed-data/bank/analytics";
import { BACKEND_BANK } from "./seed-data/bank/backend";
import { BEHAVIORAL_BANK } from "./seed-data/bank/behavioral";
import { COMMUNICATION_BANK } from "./seed-data/bank/communication";
import { DSA_BANK } from "./seed-data/bank/dsa";
import { FRONTEND_BANK } from "./seed-data/bank/frontend";
import { LLM_BANK } from "./seed-data/bank/llm";
import { ML_BANK } from "./seed-data/bank/ml";
import { MLOPS_BANK } from "./seed-data/bank/mlops";
import { SYSTEM_DESIGN_BANK } from "./seed-data/bank/system-design";
import type { SeedQuestion } from "./seed-data/types";
import { syncKnowledgeBase } from "../lib/rag/sync";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — cannot seed.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// The original 100 questions get their "what to study" key points merged in by slug.
const withKeyPoints = (q: SeedQuestion): SeedQuestion => ({ ...q, keyPoints: q.keyPoints ?? EXISTING_KEY_POINTS[q.slug] ?? [] });

const QUESTIONS: SeedQuestion[] = [
  ...AI_ML_QUESTIONS,
  ...ENGINEERING_QUESTIONS,
  ...ANALYTICS_BEHAVIORAL_QUESTIONS,
  ...LEGACY_QUESTIONS,
  // 50 per category with the originals.
  ...LLM_BANK,
  ...ML_BANK,
  ...MLOPS_BANK,
  ...SYSTEM_DESIGN_BANK,
  ...DSA_BANK,
  ...BACKEND_BANK,
  ...FRONTEND_BANK,
  ...ANALYTICS_BANK,
  ...BEHAVIORAL_BANK,
  ...COMMUNICATION_BANK,
].map(withKeyPoints);

async function main() {
  const slugs = new Set<string>();
  for (const q of QUESTIONS) {
    if (slugs.has(q.slug)) throw new Error(`Duplicate seed slug: ${q.slug}`);
    slugs.add(q.slug);
  }

  let created = 0;
  let updated = 0;
  // Batches keep the transaction size reasonable on small managed databases.
  for (let i = 0; i < QUESTIONS.length; i += 25) {
    const batch = QUESTIONS.slice(i, i + 25);
    const existing = new Set(
      (await prisma.practiceQuestion.findMany({
        where: { slug: { in: batch.map((q) => q.slug) } },
        select: { slug: true },
      })).map((r) => r.slug)
    );
    await prisma.$transaction(
      batch.map(({ slug, ...data }) =>
        prisma.practiceQuestion.upsert({ where: { slug }, create: { slug, ...data }, update: data })
      )
    );
    for (const q of batch) {
      if (existing.has(q.slug)) updated++;
      else created++;
    }
  }

  const total = await prisma.practiceQuestion.count();
  console.log(`Practice questions: ${created} created, ${updated} updated, ${total} total.`);

  // Retrieval corpus for RAG (questions, study notes, companies, GD topics).
  const kb = await syncKnowledgeBase(prisma, { log: (m) => console.log(`Knowledge base: ${m}`) });
  console.log(
    `Knowledge base: ${kb.total} chunks (${kb.created} new, ${kb.updated} changed, ${kb.deleted} removed, ${kb.embedded} embedded)` +
      (kb.embeddingError ? ` — embeddings skipped: ${kb.embeddingError}` : "")
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
