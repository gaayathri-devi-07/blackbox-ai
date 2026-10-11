import { createHash } from "node:crypto";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { KnowledgeKind, PracticeCategory, TargetRole } from "@/lib/generated/prisma/enums";
import { COMPANIES } from "@/lib/domain";
import { TOPIC_PACKS } from "@/lib/gd/topic-packs";
import { embedTexts, embeddingModel, embeddingsConfigured } from "@/lib/ai/embeddings";
import { KNOWLEDGE_NOTES } from "@/lib/rag/knowledge";

/**
 * Builds the retrieval corpus and keeps the knowledge_chunks table in sync.
 *
 * Sources: the practice question bank (question + model answer + key points),
 * curated study notes, company interview profiles and discussion topics.
 * Unchanged chunks are skipped by content hash; stale ones are deleted.
 * Embeddings are added when a Gemini key is configured; otherwise retrieval
 * runs on Postgres full-text search alone.
 *
 * No `server-only` here: `prisma/seed.ts` and `scripts/rag-ingest.ts` call it.
 */

export interface CorpusDoc {
  sourceId: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  category: PracticeCategory | null;
  roleTargets: TargetRole[];
  tags: string[];
  href: string | null;
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

function practiceHref(category: PracticeCategory, question: string): string {
  const q = question.split(/\s+/).slice(0, 6).join(" ").replace(/[^\w\s-]/g, "");
  return `/journey/practice?scope=all&category=${category}&q=${encodeURIComponent(q)}`;
}

export async function buildCorpus(prisma: PrismaClient): Promise<CorpusDoc[]> {
  const docs: CorpusDoc[] = [];

  const questions = await prisma.practiceQuestion.findMany({
    select: { slug: true, category: true, roleTargets: true, question: true, sampleAnswer: true, keyPoints: true, explanation: true, tip: true, tags: true },
  });
  for (const q of questions) {
    docs.push({
      sourceId: `q:${q.slug}`,
      kind: "QUESTION",
      title: q.question,
      content: [
        `Strong answer: ${q.sampleAnswer}`,
        q.keyPoints.length ? `Key points to cover: ${q.keyPoints.join("; ")}.` : "",
        q.explanation ? `Why it works: ${q.explanation}` : "",
        q.tip ? `Tip: ${q.tip}` : "",
        q.tags.length ? `Topics: ${q.tags.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      category: q.category,
      roleTargets: q.roleTargets,
      tags: q.tags,
      href: practiceHref(q.category, q.question),
    });
  }

  for (const note of KNOWLEDGE_NOTES) {
    note.sections.forEach((section, i) => {
      docs.push({
        sourceId: `note:${note.id}#${i + 1}`,
        kind: "NOTE",
        title: `${note.title} — ${section.heading}`,
        content: `${section.body}\nTopics: ${note.tags.join(", ")}.`,
        category: note.category ?? null,
        roleTargets: note.roles ?? [],
        tags: note.tags,
        href: null,
      });
    });
  }

  for (const c of COMPANIES) {
    docs.push({
      sourceId: `company:${c.id}`,
      kind: "COMPANY",
      title: `${c.name} interview style`,
      content: `Emphasis: ${c.emphasis}. ${c.style} Typical interviewer: ${c.interviewer.title}. Prepare examples that show ${c.emphasis.toLowerCase()}.`,
      category: null,
      roleTargets: [],
      tags: ["company", c.name.toLowerCase(), c.emphasis.toLowerCase()],
      href: null,
    });
  }

  TOPIC_PACKS.forEach((t, i) => {
    docs.push({
      sourceId: `gd:${i + 1}`,
      kind: "GD_TOPIC",
      title: t.text,
      content: [`For: ${t.pro.join(" ")}`, `Against: ${t.con.join(" ")}`, `Middle ground: ${t.middle.join(" ")}`].join("\n"),
      category: "COMMUNICATION",
      roleTargets: t.roles ?? [],
      tags: ["group discussion", t.short],
      href: null,
    });
  });

  return docs;
}

export interface SyncReport {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  embedded: number;
  embeddingError?: string;
}

export async function syncKnowledgeBase(
  prisma: PrismaClient,
  opts: { embed?: boolean; log?: (m: string) => void; /** Back off and retry on 429 (CLI only; seeding should not block). */ waitOnRateLimit?: boolean } = {}
): Promise<SyncReport> {
  const log = opts.log ?? (() => undefined);
  const docs = await buildCorpus(prisma);
  const existing = await prisma.knowledgeChunk.findMany({ select: { sourceId: true, contentHash: true } });
  const known = new Map(existing.map((e) => [e.sourceId, e.contentHash]));
  const report: SyncReport = { total: docs.length, created: 0, updated: 0, deleted: 0, embedded: 0 };

  for (const d of docs) {
    const contentHash = hash(`${d.title}\n${d.content}\n${d.roleTargets.join(",")}\n${d.category ?? ""}`);
    const previous = known.get(d.sourceId);
    if (previous === contentHash) continue;
    const data = { ...d, contentHash, embedding: [] as number[], embeddingModel: null };
    await prisma.knowledgeChunk.upsert({ where: { sourceId: d.sourceId }, create: data, update: data });
    if (previous) report.updated++;
    else report.created++;
  }

  const current = new Set(docs.map((d) => d.sourceId));
  const stale = existing.filter((e) => !current.has(e.sourceId)).map((e) => e.sourceId);
  if (stale.length) {
    const r = await prisma.knowledgeChunk.deleteMany({ where: { sourceId: { in: stale } } });
    report.deleted = r.count;
  }

  if (opts.embed !== false && embeddingsConfigured()) {
    const model = embeddingModel();
    const pending = await prisma.knowledgeChunk.findMany({
      where: { OR: [{ embeddingModel: null }, { embeddingModel: { not: model } }] },
      select: { id: true, title: true, content: true },
    });
    try {
      for (let i = 0; i < pending.length; i += 50) {
        const batch = pending.slice(i, i + 50);
        let vectors: number[][] = [];
        // Free-tier keys allow a limited number of embeddings per minute: back off and retry.
        for (let attempt = 0; ; attempt++) {
          try {
            vectors = await embedTexts(batch.map((c) => `${c.title}\n${c.content}`), "RETRIEVAL_DOCUMENT");
            break;
          } catch (error) {
            if (!/\(429\)/.test((error as Error).message) || attempt >= 3 || !opts.waitOnRateLimit) throw error;
            log(`rate limited; waiting ${30 * (attempt + 1)} s`);
            await new Promise((r) => setTimeout(r, 30_000 * (attempt + 1)));
          }
        }
        await prisma.$transaction(
          batch.map((c, j) => prisma.knowledgeChunk.update({ where: { id: c.id }, data: { embedding: vectors[j], embeddingModel: model } }))
        );
        report.embedded += batch.length;
        log(`embedded ${report.embedded}/${pending.length}`);
      }
    } catch (error) {
      // Keyword retrieval still works; embeddings are retried on the next sync.
      report.embeddingError = (error as Error).message;
    }
  }
  return report;
}
