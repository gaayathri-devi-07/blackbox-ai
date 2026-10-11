import "server-only";

import { prisma } from "@/lib/prisma";
import { aiReachable } from "@/lib/ai/gemini";
import { dot, embedTexts, embeddingModel, embeddingsConfigured } from "@/lib/ai/embeddings";
import { maskPii } from "@/lib/governance/pii";
import { traced } from "@/lib/observability/tracing";
import { syncKnowledgeBase } from "@/lib/rag/sync";
import { rerank } from "@/lib/rag/rerank";
import type { KnowledgeKind, PracticeCategory, TargetRole } from "@/lib/generated/prisma/enums";

/**
 * Hybrid retrieval over knowledge_chunks.
 *
 *   keyword  Postgres full-text search (ts_rank_cd over a weighted tsvector)
 *   vector   cosine similarity on Gemini embeddings, when they exist
 *   fusion   reciprocal rank fusion (k = 60), then small boosts for the
 *            candidate's track and the question's category
 *
 * Works fully offline on keyword search; vectors are a bonus when online.
 */

export interface RetrievedChunk {
  id: string;
  sourceId: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  category: PracticeCategory | null;
  href: string | null;
  score: number;
  retrievers: ("keyword" | "vector" | "rerank")[];
  /** 0..1 cross-encoder relevance, when a reranker ran. */
  relevance?: number;
}

export interface RetrieveOptions {
  k?: number;
  kinds?: KnowledgeKind[];
  role?: TargetRole | null;
  category?: PracticeCategory | null;
  /** Skip the embedding call (faster; keyword only). */
  keywordOnly?: boolean;
  /** Re-score candidates with the cross-encoder (default true). */
  rerank?: boolean;
}

const RRF_K = 60;
const STOP = new Set(
  "a an and are as at be but by can do does for from how i if in into is it its me my of on or our so that the their them then there these this to was we what when where which who why will with would you your about tell explain describe".split(
    " "
  )
);

/** OR-query of meaningful words, safe for to_tsquery. */
export function toTsQuery(text: string): string | null {
  const words = [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((w) => w.length >= 2 && !STOP.has(w)).slice(0, 24);
  return words.length ? words.join(" | ") : null;
}

let bootstrap: Promise<unknown> | null = null;

/** Build the corpus on first use if the ingestion step never ran. */
async function ensureCorpus(): Promise<void> {
  if (!bootstrap) {
    bootstrap = (async () => {
      const count = await prisma.knowledgeChunk.count();
      if (count === 0) await syncKnowledgeBase(prisma, { embed: false });
    })().catch((error) => {
      bootstrap = null;
      console.warn("[rag] could not build the knowledge base:", (error as Error).message);
    });
  }
  await bootstrap;
}

interface KeywordRow {
  id: string;
  source_id: string;
  kind: KnowledgeKind;
  title: string;
  content: string;
  category: PracticeCategory | null;
  role_targets: TargetRole[];
  href: string | null;
  rank: number;
}

/** Share of query terms (by 5-letter stem) that appear in a passage. */
function coverage(query: string, row: { title: string; content: string }): number {
  const terms = (toTsQuery(query) ?? "").split(" | ").filter(Boolean);
  if (!terms.length) return 0;
  const hay = `${row.title} ${row.content}`.toLowerCase();
  return terms.filter((t) => hay.includes(t.slice(0, 5))).length / terms.length;
}

async function keywordSearch(query: string, kinds: KnowledgeKind[] | undefined, limit: number): Promise<KeywordRow[]> {
  const rows = await keywordQuery(query, kinds, limit);
  // ts_rank_cd rewards dense matches of any single term; favour passages that cover more of the question.
  return rows
    .map((r) => ({ r, s: Number(r.rank) * (0.35 + coverage(query, r)) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

async function keywordQuery(query: string, kinds: KnowledgeKind[] | undefined, limit: number): Promise<KeywordRow[]> {
  const ts = toTsQuery(query);
  if (!ts) return [];
  return prisma.$queryRawUnsafe<KeywordRow[]>(
    `SELECT id, source_id, kind, title, content, category, role_targets, href, ts_rank_cd(search, q, 32) AS rank
       FROM knowledge_chunks, to_tsquery('english', $1) q
      WHERE search @@ q AND ($2::text[] IS NULL OR kind::text = ANY($2::text[]))
      ORDER BY rank DESC
      LIMIT $3`,
    ts,
    kinds?.length ? kinds : null,
    limit
  );
}

// In-process vector cache: the corpus is ~1k chunks × 768 floats (~6 MB).
let vectorCache: { at: number; model: string; rows: { id: string; kind: KnowledgeKind; v: number[] }[] } | null = null;
const VECTOR_TTL_MS = 10 * 60_000;

async function vectorRows() {
  const model = embeddingModel();
  if (vectorCache && vectorCache.model === model && Date.now() - vectorCache.at < VECTOR_TTL_MS) return vectorCache.rows;
  const [rows, total] = await Promise.all([
    prisma.knowledgeChunk.findMany({ where: { embeddingModel: model }, select: { id: true, kind: true, embedding: true } }),
    prisma.knowledgeChunk.count(),
  ]);
  // A partly embedded corpus would bias results toward whichever chunks have
  // vectors, so semantic search switches on only once nearly all are embedded.
  const usable = total > 0 && rows.length >= total * 0.9;
  vectorCache = { at: Date.now(), model, rows: usable ? rows.map((r) => ({ id: r.id, kind: r.kind, v: r.embedding })) : [] };
  return vectorCache.rows;
}

async function vectorSearch(query: string, kinds: KnowledgeKind[] | undefined, limit: number): Promise<{ id: string; sim: number }[]> {
  const rows = await vectorRows();
  if (!rows.length) return [];
  // The query leaves the server for embedding, so it is masked like any prompt.
  const [q] = await embedTexts([maskPii(query).text], "RETRIEVAL_QUERY", { timeoutMs: 4000 });
  const allowed = kinds?.length ? new Set(kinds) : null;
  return rows
    .filter((r) => !allowed || allowed.has(r.kind))
    .map((r) => ({ id: r.id, sim: dot(q, r.v) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit);
}

export async function retrieve(query: string, opts: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
  const k = opts.k ?? 5;
  if (!query.trim()) return [];
  return traced(
    "rag.retrieve",
    "retriever",
    { query, k, kinds: opts.kinds, role: opts.role, category: opts.category },
    async () => {
      await ensureCorpus();
      const pool = Math.max(20, k * 4);
      const useVectors = !opts.keywordOnly && embeddingsConfigured() && aiReachable();
      const [keyword, vector] = await Promise.all([
        keywordSearch(query, opts.kinds, pool).catch(() => [] as KeywordRow[]),
        useVectors ? vectorSearch(query, opts.kinds, pool).catch(() => []) : Promise.resolve([]),
      ]);

      const fused = new Map<string, { score: number; retrievers: Set<"keyword" | "vector"> }>();
      const add = (id: string, rank: number, source: "keyword" | "vector") => {
        const entry = fused.get(id) ?? { score: 0, retrievers: new Set() };
        entry.score += 1 / (RRF_K + rank + 1);
        entry.retrievers.add(source);
        fused.set(id, entry);
      };
      keyword.forEach((r, i) => add(r.id, i, "keyword"));
      vector.forEach((r, i) => add(r.id, i, "vector"));
      if (!fused.size) return [];

      // Load rows for vector-only hits.
      const rowsById = new Map<string, KeywordRow | null>(keyword.map((r) => [r.id, r]));
      const missing = [...fused.keys()].filter((id) => !rowsById.has(id));
      if (missing.length) {
        const extra = await prisma.knowledgeChunk.findMany({
          where: { id: { in: missing } },
          select: { id: true, sourceId: true, kind: true, title: true, content: true, category: true, roleTargets: true, href: true },
        });
        for (const e of extra) {
          rowsById.set(e.id, {
            id: e.id,
            source_id: e.sourceId,
            kind: e.kind,
            title: e.title,
            content: e.content,
            category: e.category,
            role_targets: e.roleTargets,
            href: e.href,
            rank: 0,
          });
        }
      }

      const results: RetrievedChunk[] = [];
      for (const [id, f] of fused) {
        const row = rowsById.get(id);
        if (!row) continue;
        let score = f.score;
        if (opts.role && (row.role_targets.length === 0 || row.role_targets.includes(opts.role))) score *= 1.1;
        if (opts.role && row.role_targets.length > 0 && !row.role_targets.includes(opts.role)) score *= 0.85;
        if (opts.category && row.category === opts.category) score *= 1.2;
        results.push({
          id,
          sourceId: row.source_id,
          kind: row.kind,
          title: row.title,
          content: row.content,
          category: row.category,
          href: row.href,
          score,
          retrievers: [...f.retrievers],
        });
      }
      results.sort((a, b) => b.score - a.score);
      if (opts.rerank === false) return results.slice(0, k);
      return rerankChunks(query, results.slice(0, RERANK_POOL), k);
    }
  );
}

const RERANK_POOL = 20;
/** Weight of the cross-encoder in the final score; the rest is the fused retrieval rank. */
const RERANK_WEIGHT = 0.65;

/**
 * Second stage: the cross-encoder reads query and passage together. Its
 * relevance is blended with the normalised fusion score, so a passage the
 * cross-encoder misjudges (e.g. an acronym it doesn't know) isn't discarded.
 */
async function rerankChunks(query: string, candidates: RetrievedChunk[], k: number): Promise<RetrievedChunk[]> {
  if (candidates.length <= 1) return candidates.slice(0, k);
  const scored = await traced("rag.rerank", "retriever", { query, candidates: candidates.map((c) => c.title) }, () =>
    rerank(
      query,
      candidates.map((c) => `${c.title}. ${c.content.replace(/\nTopics:[^\n]*/g, "").slice(0, 700)}`)
    )
  );
  if (!scored) return candidates.slice(0, k);
  const top = candidates[0].score || 1;
  const byIndex = new Map(scored.map((r) => [r.index, r.relevance]));
  return candidates
    .map((c, i) => {
      const relevance = byIndex.get(i) ?? 0;
      return {
        ...c,
        relevance,
        retrievers: [...c.retrievers, "rerank" as const],
        score: RERANK_WEIGHT * relevance + (1 - RERANK_WEIGHT) * (c.score / top),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Best cross-encoder relevance among retrieved chunks (null when no reranker ran). */
export function topRelevance(chunks: RetrievedChunk[]): number | null {
  const values = chunks.map((c) => c.relevance).filter((v): v is number => typeof v === "number");
  return values.length ? Math.max(...values) : null;
}

/** Numbered passages for a prompt, trimmed to a character budget. */
export function formatContext(chunks: RetrievedChunk[], maxChars = 3500): string {
  let used = 0;
  const parts: string[] = [];
  chunks.forEach((c, i) => {
    const body = c.content.length > 900 ? `${c.content.slice(0, 900)}…` : c.content;
    const block = `[${i + 1}] ${c.title}\n${body}`;
    if (used + block.length > maxChars) return;
    used += block.length;
    parts.push(block);
  });
  return parts.join("\n\n");
}

export interface Citation {
  n: number;
  title: string;
  href: string | null;
  kind: KnowledgeKind;
}

export function citationsOf(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((c, i) => ({ n: i + 1, title: c.title, href: c.href, kind: c.kind }));
}

/** Short, spoken-friendly study pointers drawn from retrieved notes and answers. */
export function studyPointsFrom(chunks: RetrievedChunk[], max = 3): string[] {
  const points: string[] = [];
  for (const c of chunks) {
    const key = /Key points to cover: ([^\n]+)/.exec(c.content)?.[1];
    if (key) points.push(...key.replace(/\.$/, "").split(/;\s*/));
    else points.push(c.content.split(/(?<=\.)\s+/)[0]);
    if (points.length >= max) break;
  }
  return points.slice(0, max).map((p) => p.trim()).filter(Boolean);
}
