/**
 * Offline RAG benchmark: faithfulness and answer relevance on a golden dataset.
 *
 *   cd frontend
 *   npm run eval:rag                  # local report
 *   npm run eval:rag -- --langsmith   # also upload dataset + experiment to LangSmith
 *
 * For every golden item it runs the production pipeline (hybrid retrieval →
 * cross-encoder rerank → sufficiency gate → cited generation → citation
 * validation) via answerWithCitations, then scores:
 *
 *   context_recall     an expected source is in the retrieved context
 *   faithfulness       share of answer claims supported by the retrieved context
 *   answer_relevance   how well the answer addresses the question (vs. reference)
 *   citation_validity  answered items cite at least one real source
 *   decline_accuracy   unanswerable items are declined; answerable ones are not
 *
 * Faithfulness and relevance use an LLM judge (Gemini) when a key is set and
 * transparent lexical heuristics otherwise, so the script runs offline too.
 * A JSON report is written to backend/evals/results/.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..", "..", "frontend");
// Dependencies live in frontend/node_modules; resolve them from there.
const requireFromFrontend = createRequire(join(frontend, "package.json"));
const { config } = requireFromFrontend("dotenv") as typeof import("dotenv");
config({ path: [join(frontend, ".env.local"), join(frontend, ".env")], quiet: true });

interface GoldenItem {
  id: string;
  question: string;
  referenceAnswer: string;
  expectedSources: string[];
  answerable: boolean;
}

interface Row {
  id: string;
  question: string;
  status: string;
  answer: string;
  contextIds: string[];
  citations: number;
  scores: Record<string, number | null>;
  judge: "llm" | "heuristic";
}

const GATES: Record<string, number> = {
  context_recall: 0.85,
  faithfulness: 0.8,
  answer_relevance: 0.7,
  citation_validity: 0.95,
  decline_accuracy: 0.9,
};

const STOP = new Set(
  "a an and are as at be but by can do does for from how i if in into is it its of on or so that the their them then there these this to was we what when where which who why will with you your should".split(" ")
);
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9@#+.-]{2,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 6));

/** Share of answer sentences whose content words mostly appear in some context passage. */
function heuristicFaithfulness(answer: string, context: string[]): number {
  const sentences = answer
    .replace(/\[\d+\]/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[-•\s]+/, "").trim())
    .filter((s) => s.split(/\s+/).length >= 4);
  if (!sentences.length) return 0;
  const passages = context.map((c) => new Set(words(c)));
  const supported = sentences.filter((s) => {
    const w = words(s);
    if (!w.length) return true;
    return passages.some((p) => w.filter((x) => p.has(x)).length / w.length >= 0.5);
  });
  return supported.length / sentences.length;
}

/** Recall of the reference answer's key terms in the generated answer. */
function heuristicRelevance(answer: string, reference: string, question: string): number {
  const ref = new Set([...words(reference), ...words(question)]);
  if (!ref.size) return 0;
  const got = new Set(words(answer));
  const hit = [...ref].filter((w) => got.has(w)).length;
  return Math.min(1, (hit / ref.size) * 1.6);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const golden = JSON.parse(readFileSync(join(here, "rag_golden.json"), "utf8")) as { items: GoldenItem[] };
  const { answerWithCitations } = await import("../../frontend/lib/rag/answer");
  const { generateJson, aiReachable } = await import("../../frontend/lib/ai/gemini");
  const { z } = requireFromFrontend("zod") as typeof import("zod");
  const useJudge = aiReachable() && !args.has("--heuristic");
  const judgeSchema = z.object({
    faithfulness: z.number().min(0).max(1),
    answer_relevance: z.number().min(0).max(1),
    reason: z.string().max(400),
  });

  const relevant = (id: string, labels: string[]) => labels.some((l) => (l.endsWith("#") ? id.startsWith(l) : id === l));
  const rows: Row[] = [];

  for (const item of golden.items) {
    const res = await answerWithCitations({ question: item.question });
    const contextText = res.context.map((c) => `${c.title}\n${c.content}`);
    const declined = res.status === "insufficient";
    const scores: Row["scores"] = {
      decline_accuracy: declined === !item.answerable ? 1 : 0,
      context_recall: item.answerable ? (res.context.some((c) => relevant(c.sourceId, item.expectedSources)) ? 1 : 0) : null,
      citation_validity: item.answerable && !declined ? (res.citations.length > 0 ? 1 : 0) : null,
      faithfulness: null,
      answer_relevance: null,
    };
    let judge: Row["judge"] = "heuristic";
    if (item.answerable && !declined) {
      if (useJudge) {
        try {
          const verdict = await generateJson(judgeSchema, {
            system: "You are a strict evaluator of retrieval-augmented answers. Judge only against the provided context and reference.",
            prompt: [
              `Question: ${item.question}`,
              `Retrieved context:\n${contextText.map((c, i) => `[${i + 1}] ${c}`).join("\n\n").slice(0, 9000)}`,
              `Answer to evaluate:\n${res.text}`,
              `Reference answer: ${item.referenceAnswer}`,
              'Return JSON: "faithfulness" = fraction (0-1) of the answer\'s factual claims that are directly supported by the retrieved context; "answer_relevance" = 0-1 how completely and directly the answer addresses the question, compared with the reference; "reason" = one sentence.',
            ].join("\n\n"),
            temperature: 0,
            maxOutputTokens: 1200,
            timeoutMs: 25_000,
            feature: "eval.rag",
          });
          scores.faithfulness = verdict.faithfulness;
          scores.answer_relevance = verdict.answer_relevance;
          judge = "llm";
        } catch {
          /* fall back to heuristics below */
        }
      }
      if (judge === "heuristic") {
        scores.faithfulness = heuristicFaithfulness(res.status === "offline" ? res.text.replace(/^Live AI is offline[^\n]*\n+/, "") : res.text, contextText);
        scores.answer_relevance = heuristicRelevance(res.text, item.referenceAnswer, item.question);
      }
    }
    rows.push({
      id: item.id,
      question: item.question,
      status: res.status,
      answer: res.text,
      contextIds: res.context.map((c) => c.sourceId),
      citations: res.citations.length,
      scores,
      judge,
    });
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const metrics = Object.fromEntries(
    Object.keys(GATES).map((k) => {
      const values = rows.map((r) => r.scores[k]).filter((v): v is number => typeof v === "number");
      return [k, values.length ? values.reduce((a, b) => a + b, 0) / values.length : null];
    })
  ) as Record<string, number | null>;

  console.log(`\nRAG eval — ${rows.length} items · judge: ${useJudge ? "LLM (Gemini)" : "heuristic (offline)"}\n`);
  console.log("id".padEnd(18), "status".padEnd(13), "recall faith  relev  cites");
  for (const r of rows) {
    const f = (k: string) => (r.scores[k] === null ? "  —  " : (r.scores[k] as number).toFixed(2).padStart(5));
    console.log(r.id.padEnd(18), r.status.padEnd(13), f("context_recall"), f("faithfulness"), f("answer_relevance"), String(r.citations).padStart(4));
  }
  console.log("");
  let failed = 0;
  for (const [k, gate] of Object.entries(GATES)) {
    const v = metrics[k];
    const pass = v !== null && v >= gate;
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"}  ${k.padEnd(18)} ${v === null ? "n/a" : v.toFixed(3)}  (gate ${gate})`);
  }

  const outDir = join(here, "results");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `rag-eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), judge: useJudge ? "llm" : "heuristic", metrics, gates: GATES, rows }, null, 2));
  console.log(`\nReport: ${file}`);

  if (args.has("--langsmith")) {
    if (!process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) {
      console.log("LangSmith upload skipped: set LANGSMITH_API_KEY.");
    } else {
      const { Client } = requireFromFrontend("langsmith") as typeof import("langsmith");
      const { evaluate } = requireFromFrontend("langsmith/evaluation") as typeof import("langsmith/evaluation");
      const client = new Client();
      const datasetName = "blackbox-rag-golden";
      if (!(await client.hasDataset({ datasetName }))) {
        const ds = await client.createDataset(datasetName, { description: "Blackbox RAG golden Q&A pairs" });
        await client.createExamples(
          golden.items.map((i) => ({ inputs: { question: i.question }, outputs: { reference: i.referenceAnswer, sources: i.expectedSources, answerable: i.answerable }, dataset_id: ds.id }))
        );
      }
      const byQuestion = new Map(rows.map((r) => [r.question, r]));
      const result = await evaluate(async (inputs: Record<string, unknown>) => {
        const r = byQuestion.get(String(inputs.question));
        return { answer: r?.answer ?? "", status: r?.status ?? "missing", scores: r?.scores ?? {} };
      }, {
        data: datasetName,
        client,
        experimentPrefix: "blackbox-rag",
        evaluators: Object.keys(GATES).map((key) => ({ outputs }: { outputs: Record<string, unknown> }) => {
          const v = (outputs.scores as Record<string, number | null> | undefined)?.[key];
          return { key, score: typeof v === "number" ? v : undefined };
        }),
      });
      console.log(`LangSmith experiment: ${result.experimentName}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mod = await import("../../frontend/lib/prisma").catch(() => null);
    await mod?.prisma.$disconnect().catch(() => undefined);
    // onnxruntime keeps worker threads alive; exit explicitly once done.
    setTimeout(() => process.exit(process.exitCode ?? 0), 200);
  });
