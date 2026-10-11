/**
 * Blackbox evals.
 *
 *   npm run eval              local run: every suite, scores and pass/fail gates
 *   npm run eval:langsmith    also uploads datasets to LangSmith and records an
 *                             experiment per suite (needs LANGSMITH_API_KEY)
 *   npm run eval -- --online  adds model-graded suites (needs GEMINI_API_KEY)
 *
 * Suites: retrieval quality (hit@k, MRR), PII masking, prompt-injection
 * detection, offline grader calibration, voice emotion, and — online — an
 * LLM-as-judge check that interview feedback is grounded and useful.
 * Exits non-zero when a gate fails, so CI can block a regression.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

type KV = Record<string, unknown>;
interface Example {
  inputs: KV;
  outputs: KV;
}
type Evaluator = (args: { inputs: KV; outputs: KV; referenceOutputs?: KV }) => { key: string; score: number; comment?: string };
interface Suite {
  name: string;
  description: string;
  examples: Example[];
  target: (inputs: KV) => Promise<KV>;
  evaluators: Evaluator[];
  /** Minimum mean score per evaluator key. */
  gates: Record<string, number>;
}

const args = new Set(process.argv.slice(2));

async function buildSuites(): Promise<Suite[]> {
  const d = await import("./datasets");
  const { maskPii } = await import("../lib/governance/pii");
  const { scanForInjection } = await import("../lib/governance/guard");
  const { inferEmotion } = await import("../lib/voice/prosody");

  const suites: Suite[] = [
    {
      name: "pii-masking",
      description: "Personal data is masked; technical numbers are not.",
      examples: d.PII.map((e) => ({ inputs: { input: e.input, names: e.names ?? [] }, outputs: { expected: e.expected } })),
      target: async (i) => ({ masked: maskPii(String(i.input), { names: (i.names as string[]) ?? [] }).text }),
      evaluators: [({ outputs, referenceOutputs }) => ({ key: "exact_match", score: outputs.masked === referenceOutputs?.expected ? 1 : 0 })],
      gates: { exact_match: 0.95 },
    },
    {
      name: "prompt-injection",
      description: "Injection attempts in candidate text are flagged without flagging normal answers.",
      examples: d.INJECTION.map((e) => ({ inputs: { input: e.input }, outputs: { flagged: e.flagged } })),
      target: async (i) => ({ flags: scanForInjection(String(i.input)) }),
      evaluators: [
        ({ outputs, referenceOutputs }) => ({
          key: "correct",
          score: ((outputs.flags as string[]).length > 0) === referenceOutputs?.flagged ? 1 : 0,
        }),
      ],
      gates: { correct: 0.9 },
    },
    {
      name: "voice-emotion",
      description: "Interviewer lines get the intended emotional delivery.",
      examples: d.EMOTION.map((e) => ({ inputs: { text: e.text, move: e.move, mode: e.mode }, outputs: { emotion: e.expected } })),
      target: async (i) => ({
        emotion: inferEmotion(String(i.text), { move: i.move as never, mode: i.mode as never }),
      }),
      evaluators: [({ outputs, referenceOutputs }) => ({ key: "exact_match", score: outputs.emotion === referenceOutputs?.emotion ? 1 : 0 })],
      gates: { exact_match: 0.8 },
    },
  ];

  // Suites below need the database (server modules); run with --conditions=react-server.
  if (process.env.DATABASE_URL) {
    const { retrieve } = await import("../lib/rag/retrieve");
    const { heuristicAnswerScore } = await import("../lib/ai/interview");
    const relevant = (id: string, labels: string[]) => labels.some((l) => (l.endsWith("#") ? id.startsWith(l) : id === l));

    suites.push({
      name: "rag-retrieval",
      description: "Hybrid retrieval finds the right passage for interview questions.",
      examples: d.RETRIEVAL.map((e) => ({ inputs: { query: e.query, role: e.role ?? null }, outputs: { relevant: e.relevant } })),
      target: async (i) => ({
        ids: (await retrieve(String(i.query), { k: 5, role: (i.role as never) ?? null })).map((c) => c.sourceId),
      }),
      evaluators: [
        ({ outputs, referenceOutputs }) => ({
          key: "hit_at_5",
          score: (outputs.ids as string[]).some((id) => relevant(id, referenceOutputs?.relevant as string[])) ? 1 : 0,
        }),
        ({ outputs, referenceOutputs }) => {
          const rank = (outputs.ids as string[]).findIndex((id) => relevant(id, referenceOutputs?.relevant as string[]));
          return { key: "mrr", score: rank < 0 ? 0 : 1 / (rank + 1) };
        },
      ],
      gates: { hit_at_5: 0.85, mrr: 0.6 },
    });

    suites.push({
      name: "offline-grader",
      description: "The rule-based grader used offline ranks weak, average and strong answers correctly.",
      examples: d.SCORING.map((e) => ({ inputs: { answer: e.answer }, outputs: { band: e.band } })),
      target: async (i) => ({ score: heuristicAnswerScore(String(i.answer)).score }),
      evaluators: [
        ({ outputs, referenceOutputs }) => {
          const s = Number(outputs.score);
          const band = s < 40 ? "low" : s < 65 ? "mid" : "high";
          return { key: "band_match", score: band === referenceOutputs?.band ? 1 : 0, comment: `score ${s}` };
        },
      ],
      gates: { band_match: 0.8 },
    });

    if (args.has("--online") && process.env.GEMINI_API_KEY) {
      const { answerFeedback } = await import("../lib/ai/interview");
      const { generateJson } = await import("../lib/ai/gemini");
      const { getCompany } = await import("../lib/domain");
      const { z } = await import("zod");
      const judge = z.object({ grounded: z.number().min(0).max(1), actionable: z.number().min(0).max(1), reason: z.string() });
      const cases = [
        { q: "How would you evaluate a RAG system?", a: "I would just ask users if they like it." },
        { q: "Tell me about a time you handled a conflict.", a: "My teammate and I disagreed on the API design. I set up a call, we listed trade-offs, and agreed to prototype both. We picked the faster one and shipped a week early." },
        { q: "What is the KV cache in LLM inference?", a: "I don't know." },
      ];
      suites.push({
        name: "feedback-quality",
        description: "LLM-as-judge: interview feedback is correct, grounded and actionable.",
        examples: cases.map((c) => ({ inputs: { question: c.q, answer: c.a }, outputs: {} })),
        target: async (i) => {
          const fb = await answerFeedback(
            { role: "AI_ENGINEER", company: getCompany("google"), mode: "STANDARD", experienceLevel: "MID" },
            { role: "interviewer", kind: "question", content: String(i.question), prompt: String(i.question), at: Date.now() },
            String(i.answer)
          );
          const verdict = await generateJson(judge, {
            system: "You grade interview-coaching feedback. Be strict.",
            prompt: `Question: ${i.question}\nCandidate answer: ${i.answer}\nFeedback given: ${JSON.stringify(fb)}\n\nReturn JSON: grounded (0-1: technically correct and consistent with the question, no invented facts), actionable (0-1: tells the candidate exactly what to improve), reason (one sentence).`,
            temperature: 0,
            feature: "eval.judge",
          });
          return { score: fb.score, source: fb.source, ...verdict };
        },
        evaluators: [
          ({ outputs }) => ({ key: "grounded", score: Number(outputs.grounded), comment: String(outputs.reason) }),
          ({ outputs }) => ({ key: "actionable", score: Number(outputs.actionable) }),
        ],
        gates: { grounded: 0.7, actionable: 0.7 },
      });
    }
  }
  return suites;
}

async function runLocal(suite: Suite) {
  const totals: Record<string, number[]> = {};
  const failures: string[] = [];
  for (const ex of suite.examples) {
    const outputs = await suite.target(ex.inputs);
    for (const ev of suite.evaluators) {
      const r = ev({ inputs: ex.inputs, outputs, referenceOutputs: ex.outputs });
      (totals[r.key] ??= []).push(r.score);
      if (r.score < 1 && failures.length < 5) failures.push(`  · ${r.key}=${r.score.toFixed(2)} ← ${JSON.stringify(ex.inputs).slice(0, 110)}${r.comment ? ` (${r.comment})` : ""}`);
    }
  }
  const means = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
  const passed = Object.entries(suite.gates).every(([k, min]) => (means[k] ?? 0) >= min);
  return { means, passed, failures };
}

async function runLangSmith(suite: Suite) {
  const { Client } = await import("langsmith");
  const { evaluate } = await import("langsmith/evaluation");
  const client = new Client();
  const datasetName = `blackbox-${suite.name}`;
  if (await client.hasDataset({ datasetName })) {
    let count = 0;
    for await (const example of client.listExamples({ datasetName })) if (example) count++;
    if (count !== suite.examples.length) {
      await client.deleteDataset({ datasetName });
    }
  }
  if (!(await client.hasDataset({ datasetName }))) {
    const ds = await client.createDataset(datasetName, { description: suite.description });
    await client.createExamples(suite.examples.map((e) => ({ inputs: e.inputs, outputs: e.outputs, dataset_id: ds.id })));
  }
  const results = await evaluate((inputs: KV) => suite.target(inputs), {
    data: datasetName,
    evaluators: suite.evaluators,
    experimentPrefix: datasetName,
    description: suite.description,
    metadata: { suite: suite.name, models: process.env.GEMINI_MODELS ?? "default", embeddings: process.env.GEMINI_EMBEDDING_MODEL ?? "default" },
    client,
    maxConcurrency: 4,
  });
  return results.experimentName;
}

async function main() {
  const suites = await buildSuites();
  const useLangSmith = args.has("--langsmith");
  if (useLangSmith && !process.env.LANGSMITH_API_KEY) {
    console.error("LANGSMITH_API_KEY is not set — add it to .env.local to upload evals.");
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  console.log(`\nBlackbox evals — ${suites.length} suites\n`);
  for (const suite of suites) {
    const { means, passed, failures } = await runLocal(suite);
    if (!passed) failed++;
    const metrics = Object.entries(means)
      .map(([k, v]) => `${k} ${v.toFixed(2)}${suite.gates[k] !== undefined ? ` (gate ${suite.gates[k]})` : ""}`)
      .join(", ");
    console.log(`${passed ? "PASS" : "FAIL"}  ${suite.name.padEnd(18)} n=${String(suite.examples.length).padEnd(3)} ${metrics}`);
    if (!passed || args.has("--verbose")) failures.forEach((f) => console.log(f));
    if (useLangSmith) {
      try {
        const experiment = await runLangSmith(suite);
        console.log(`      ↳ LangSmith experiment: ${experiment}`);
      } catch (error) {
        console.log(`      ↳ LangSmith upload failed: ${(error as Error).message}`);
      }
    }
  }
  if (!process.env.DATABASE_URL) console.log("\n(DATABASE_URL not set: retrieval and grader suites skipped.)");
  console.log(failed ? `\n${failed} suite(s) below their gate.` : "\nAll gates passed.");
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma").catch(() => ({ prisma: null }));
    await prisma?.$disconnect().catch(() => undefined);
  });
