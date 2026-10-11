import "server-only";

import os from "node:os";
import path from "node:path";

/**
 * Cross-encoder reranking.
 *
 * Retrieval (keyword + vector, fused) is recall-oriented: it finds ~20
 * candidates quickly. A cross-encoder then reads the query and each passage
 * *together* and scores how well the passage answers the query, which is far
 * more precise than comparing two independent embeddings.
 *
 * Providers (RERANKER env):
 *   local   ms-marco-MiniLM-L-6-v2 (ONNX, int8) on the server via transformers.js.
 *           No key, works offline, ~25 ms for 20 passages once loaded. Default.
 *   cohere  Cohere Rerank API (COHERE_API_KEY), model rerank-v3.5.
 *   jina    Jina Reranker API (JINA_API_KEY), jina-reranker-v2-base-multilingual.
 *   off     Skip reranking.
 *
 * Every provider returns a relevance in 0..1 (sigmoid of the logit for the local
 * model), which RAG uses to decide whether the context is sufficient to answer.
 */

export interface RerankResult {
  index: number;
  /** 0..1 — how well the passage answers the query. */
  relevance: number;
}

export type RerankerName = "local" | "cohere" | "jina" | "off";

export function rerankerName(): RerankerName {
  const configured = (process.env.RERANKER ?? "local").toLowerCase();
  if (configured === "cohere" && process.env.COHERE_API_KEY) return "cohere";
  if (configured === "jina" && process.env.JINA_API_KEY) return "jina";
  if (configured === "off") return "off";
  return "local";
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// ─── Local cross-encoder ──────────────────────────────────────────────────────

const LOCAL_MODEL = process.env.RERANKER_MODEL || "Xenova/ms-marco-MiniLM-L-6-v2";

interface LocalModel {
  score: (query: string, docs: string[]) => Promise<number[]>;
}

let localModel: Promise<LocalModel> | null = null;
let localFailedAt = 0;

async function loadLocal(): Promise<LocalModel> {
  const tf = await import("@huggingface/transformers");
  // Serverless file systems are read-only except the temp directory.
  tf.env.cacheDir = process.env.TRANSFORMERS_CACHE || path.join(os.tmpdir(), "bbx-transformers");
  tf.env.allowLocalModels = false;
  const [tokenizer, model] = await Promise.all([
    tf.AutoTokenizer.from_pretrained(LOCAL_MODEL),
    tf.AutoModelForSequenceClassification.from_pretrained(LOCAL_MODEL, { dtype: "q8" }),
  ]);
  return {
    score: async (query, docs) => {
      const inputs = tokenizer(new Array(docs.length).fill(query), { text_pair: docs, padding: true, truncation: true, max_length: 384 });
      const out = (await model(inputs)) as { logits: { data: ArrayLike<number> } };
      return Array.from(out.logits.data, Number);
    },
  };
}

function local(): Promise<LocalModel> {
  if (!localModel) {
    localModel = loadLocal().catch((error: unknown) => {
      localModel = null;
      localFailedAt = Date.now();
      throw error;
    });
  }
  return localModel;
}

/** Start loading the local model in the background (called at server start). */
export function warmReranker(): void {
  if (rerankerName() === "local") void local().catch(() => undefined);
}

// ─── Hosted rerank APIs ───────────────────────────────────────────────────────

async function hosted(provider: "cohere" | "jina", query: string, docs: string[]): Promise<RerankResult[]> {
  const url = provider === "cohere" ? "https://api.cohere.com/v2/rerank" : "https://api.jina.ai/v1/rerank";
  const key = provider === "cohere" ? process.env.COHERE_API_KEY : process.env.JINA_API_KEY;
  const model = provider === "cohere" ? "rerank-v3.5" : "jina-reranker-v2-base-multilingual";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, query, documents: docs, top_n: docs.length }),
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${provider} rerank failed (${res.status})`);
  const data = (await res.json()) as { results?: { index: number; relevance_score: number }[] };
  return (data.results ?? []).map((r) => ({ index: r.index, relevance: r.relevance_score }));
}

/**
 * Score passages against a query. Returns null when no reranker is available,
 * so callers keep the fused retrieval order.
 */
export async function rerank(query: string, docs: string[]): Promise<RerankResult[] | null> {
  if (!docs.length) return [];
  const provider = rerankerName();
  if (provider === "off") return null;
  try {
    if (provider === "cohere" || provider === "jina") return await hosted(provider, query, docs);
    // After a failed load, wait before trying again (e.g. no network for the model download).
    if (!localModel && Date.now() - localFailedAt < 5 * 60_000) return null;
    const model = await Promise.race([
      local(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("reranker still loading")), 8000)),
    ]);
    const logits = await model.score(query, docs);
    return logits.map((l, index) => ({ index, relevance: sigmoid(l) }));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("[rerank] unavailable:", (error as Error).message);
    return null;
  }
}
