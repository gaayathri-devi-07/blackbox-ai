/**
 * Text embeddings for retrieval (Gemini embedding API).
 *
 * Deliberately free of `server-only` so the ingestion script can run it under
 * tsx; it is only ever imported by server code. Vectors are truncated to 768
 * dimensions (Matryoshka) and L2-normalised, so cosine similarity is a dot product.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const EMBEDDING_DIMS = 768;

export function embeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
}

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.RAG_EMBEDDINGS !== "off";
}

export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function normalise(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** Embed up to 100 texts per request. Throws on network or API errors. */
export async function embedTexts(texts: string[], task: EmbeddingTask, opts: { timeoutMs?: number } = {}): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const model = embeddingModel();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType: task,
          outputDimensionality: EMBEDDING_DIMS,
        })),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Embedding request failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
    const vectors = data.embeddings ?? [];
    if (vectors.length !== batch.length) throw new Error("Embedding response size mismatch.");
    for (const v of vectors) out.push(normalise(v.values ?? []));
  }
  return out;
}
