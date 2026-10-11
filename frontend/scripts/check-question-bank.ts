/**
 * Sanity checks for the practice question bank: counts per category, duplicate
 * slugs or questions, and missing key points. Run: npx tsx scripts/check-question-bank.ts
 */
import { AI_ML_QUESTIONS } from "../prisma/seed-data/ai-ml-questions";
import { ANALYTICS_BEHAVIORAL_QUESTIONS } from "../prisma/seed-data/analytics-behavioral-questions";
import { ENGINEERING_QUESTIONS } from "../prisma/seed-data/engineering-questions";
import { LEGACY_QUESTIONS } from "../prisma/seed-data/legacy-questions";
import { EXISTING_KEY_POINTS } from "../prisma/seed-data/existing-key-points";
import { ANALYTICS_BANK } from "../prisma/seed-data/bank/analytics";
import { BACKEND_BANK } from "../prisma/seed-data/bank/backend";
import { BEHAVIORAL_BANK } from "../prisma/seed-data/bank/behavioral";
import { COMMUNICATION_BANK } from "../prisma/seed-data/bank/communication";
import { DSA_BANK } from "../prisma/seed-data/bank/dsa";
import { FRONTEND_BANK } from "../prisma/seed-data/bank/frontend";
import { LLM_BANK } from "../prisma/seed-data/bank/llm";
import { ML_BANK } from "../prisma/seed-data/bank/ml";
import { MLOPS_BANK } from "../prisma/seed-data/bank/mlops";
import { SYSTEM_DESIGN_BANK } from "../prisma/seed-data/bank/system-design";

const original = [...AI_ML_QUESTIONS, ...ENGINEERING_QUESTIONS, ...ANALYTICS_BEHAVIORAL_QUESTIONS, ...LEGACY_QUESTIONS];
const added = [...LLM_BANK, ...ML_BANK, ...MLOPS_BANK, ...SYSTEM_DESIGN_BANK, ...DSA_BANK, ...BACKEND_BANK, ...FRONTEND_BANK, ...ANALYTICS_BANK, ...BEHAVIORAL_BANK, ...COMMUNICATION_BANK];
const all = [...original, ...added];

let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.log("FAIL", msg);
};

const counts: Record<string, number> = {};
for (const q of all) counts[q.category] = (counts[q.category] ?? 0) + 1;
console.log("Per category:");
for (const [c, n] of Object.entries(counts).sort()) console.log(`  ${c.padEnd(22)} ${n}${n === 50 ? "" : "  ← expected 50"}`);
console.log(`  ${"TOTAL".padEnd(22)} ${all.length}`);

const slugs = new Map<string, number>();
const texts = new Map<string, string>();
for (const q of all) {
  slugs.set(q.slug, (slugs.get(q.slug) ?? 0) + 1);
  const norm = q.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (texts.has(norm)) fail(`duplicate question text: ${q.slug} and ${texts.get(norm)}`);
  texts.set(norm, q.slug);
}
for (const [s, n] of slugs) if (n > 1) fail(`duplicate slug: ${s}`);
for (const q of original) if (!q.keyPoints && !EXISTING_KEY_POINTS[q.slug]) fail(`no key points for original question: ${q.slug}`);
for (const s of Object.keys(EXISTING_KEY_POINTS)) if (!original.some((q) => q.slug === s)) fail(`key points for unknown slug: ${s}`);
for (const q of added) {
  if (q.keyPoints!.length < 3 || q.keyPoints!.length > 4) fail(`${q.slug}: ${q.keyPoints!.length} key points`);
  if (q.sampleAnswer.split(/\s+/).length < 50) fail(`${q.slug}: sample answer under 50 words`);
}
console.log(problems ? `\n${problems} problem(s)` : "\nAll checks passed.");
process.exit(problems ? 1 : 0);
