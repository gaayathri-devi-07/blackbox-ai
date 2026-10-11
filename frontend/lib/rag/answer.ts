import "server-only";

import { AIUnavailableError, generateText, type ChatTurn } from "@/lib/ai/gemini";
import { traced } from "@/lib/observability/tracing";
import { citationsOf, formatContext, retrieve, topRelevance, type Citation, type RetrievedChunk } from "@/lib/rag/retrieve";
import type { TargetRole } from "@/lib/generated/prisma/enums";

/**
 * Grounded answering with enforced citations.
 *
 *   1. Retrieve (hybrid) and rerank (cross-encoder).
 *   2. Sufficiency gate: if the best cross-encoder relevance is below
 *      RAG_MIN_RELEVANCE, decline instead of letting the model improvise.
 *   3. Generate with strict rules: every factual sentence cites [n]; if the
 *      sources don't answer the question, reply INSUFFICIENT_CONTEXT.
 *   4. Validate: drop citations to sources that don't exist; an answer with no
 *      valid citation is treated as unsupported and declined.
 *
 * Offline, the answer is extracted from the top passages, with citations.
 */

export const INSUFFICIENT = "INSUFFICIENT_CONTEXT";

export function minRelevance(): number {
  const v = Number(process.env.RAG_MIN_RELEVANCE);
  return Number.isFinite(v) && v > 0 ? v : 0.05;
}

export type AnswerStatus = "grounded" | "insufficient" | "offline";

export interface GroundedAnswer {
  text: string;
  status: AnswerStatus;
  /** Sources actually cited in the answer. */
  citations: Citation[];
  /** Everything that was given to the model (for traces and evals). */
  context: RetrievedChunk[];
  relevance: number | null;
}

export const GROUNDING_RULES = [
  "Answer ONLY from the numbered sources below. Do not use outside knowledge.",
  "After every sentence that states a fact or recommendation, cite its source in square brackets, e.g. [1] or [2][3]. Only cite numbers that exist.",
  `If the sources do not contain enough information to answer, reply with exactly ${INSUFFICIENT} and nothing else.`,
].join("\n");

/** Parse [n] citations and keep only those that point at a real source. */
export function validateCitations(text: string, sourceCount: number): { text: string; cited: number[] } {
  const cited = new Set<number>();
  const cleaned = text.replace(/\[(\d{1,2})\]/g, (whole, n: string) => {
    const i = Number(n);
    if (i >= 1 && i <= sourceCount) {
      cited.add(i);
      return whole;
    }
    return "";
  });
  return { text: cleaned.replace(/\s+([.,;:])/g, "$1").trim(), cited: [...cited].sort((a, b) => a - b) };
}

export function declineMessage(chunks: RetrievedChunk[]): string {
  // Suggest neighbours only when they are at least loosely related.
  const near = chunks
    .filter((c) => (c.relevance ?? 0) >= 0.01)
    .slice(0, 3)
    .map((c) => c.title.replace(/ — .*$/, ""));
  return [
    "I don't have enough grounded material in the Blackbox knowledge base to answer that reliably, so I won't guess.",
    near.length ? `The closest topics I do have are: ${near.join("; ")}.` : "",
    "Try asking about an interview topic, or open a practice question to get feedback on your own answer.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Offline answer: the leading sentences of the best passages, each cited. */
function extractive(chunks: RetrievedChunk[]): { text: string; cited: number[] } {
  const lines = chunks.slice(0, 3).map((c, i) => {
    const body = c.content.replace(/\nTopics:[^\n]*/g, "").replace(/^Strong answer: /, "");
    const sentences = body.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    return `- ${sentences} [${i + 1}]`;
  });
  return { text: `Live AI is offline, so here is what the knowledge base says:\n\n${lines.join("\n")}`, cited: lines.map((_, i) => i + 1) };
}

export async function answerWithCitations(opts: {
  question: string;
  role?: TargetRole | null;
  system?: string;
  history?: ChatTurn[];
  /** Extra source placed first, e.g. a practice question's reference answer. */
  pinnedSource?: { title: string; content: string };
  k?: number;
}): Promise<GroundedAnswer> {
  return traced("rag.answer", "chain", { question: opts.question }, async () => {
    const retrieved = await retrieve(opts.question, { k: opts.k ?? 5, role: opts.role }).catch(() => [] as RetrievedChunk[]);
    const pinned: RetrievedChunk[] = opts.pinnedSource
      ? [
          {
            id: "pinned",
            sourceId: "pinned",
            kind: "QUESTION",
            title: opts.pinnedSource.title,
            content: opts.pinnedSource.content,
            category: null,
            href: null,
            score: 1,
            retrievers: [],
            relevance: 1,
          },
        ]
      : [];
    const context = [...pinned, ...retrieved];
    const relevance = topRelevance(context);

    // Sufficiency gate (only when a reranker scored the passages).
    if (!context.length || (relevance !== null && relevance < minRelevance())) {
      return { text: declineMessage(retrieved), status: "insufficient" as const, citations: [], context, relevance };
    }

    const system = [opts.system, GROUNDING_RULES, `Sources:\n\n${formatContext(context, 5000)}`].filter(Boolean).join("\n\n");
    let raw: string;
    try {
      raw = await generateText({
        system,
        turns: [...(opts.history ?? []), { role: "user", text: opts.question }],
        temperature: 0.3,
        maxOutputTokens: 1500,
        timeoutMs: 20_000,
        feature: "rag.answer",
      });
    } catch (error) {
      if (!(error instanceof AIUnavailableError)) throw error;
      const offline = extractive(context);
      const cites = citationsOf(context).filter((c) => offline.cited.includes(c.n));
      return { text: offline.text, status: "offline" as const, citations: cites, context, relevance };
    }

    if (raw.trim().toUpperCase().startsWith(INSUFFICIENT)) {
      return { text: declineMessage(retrieved), status: "insufficient" as const, citations: [], context, relevance };
    }
    const { text, cited } = validateCitations(raw, context.length);
    if (!cited.length) {
      // No valid citation means the answer isn't supported by the sources.
      return { text: declineMessage(retrieved), status: "insufficient" as const, citations: [], context, relevance };
    }
    return { text, status: "grounded" as const, citations: citationsOf(context).filter((c) => cited.includes(c.n)), context, relevance };
  });
}
