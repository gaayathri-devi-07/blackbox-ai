# Blackbox

Interview and group-discussion preparation for engineers, analysts and graduates: adaptive mock
interviews with expressive AI voices, a moderated group-discussion room with strict floor control, a
500-question practice bank, project reviews, a planning agent, and grounded (RAG) coaching — with PII
masking, an AI audit log and LangSmith evals built in. Everything is persisted to PostgreSQL.

```
frontend/   Next.js 16 app (UI + API routes), Prisma 7, PostgreSQL
backend/    Optional FastAPI service (not used by the frontend)
legacy/     Code retired during the 2026 redesign, kept for reference — safe to delete
docs/       Project guide (PDF + HTML source)
```

## Quick start (VS Code, no database install needed)

1. Open the `blackbox-ai` folder in VS Code.
2. Open a terminal (**Terminal → New Terminal**) and run:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open <http://localhost:3000>, click **Log in**, and sign in with Google or GitHub (or **Enter with
   demo account** locally).

`npm run dev` starts a private PostgreSQL 17 inside the project (data in `frontend/.local-db`), applies
migrations, seeds the question bank and the RAG knowledge base, and starts the site. Press **Ctrl+C**
to stop everything. `npm run dev:next` runs only Next.js against your own `DATABASE_URL`.

### Online and offline

| | With `GEMINI_API_KEY` and internet | Without a key, or when Gemini is unreachable |
| --- | --- | --- |
| Interviewer | Model-written turns, follow-ups and coaching, grounded in retrieved notes | Practice-bank questions chosen by track, level and job description; rule-based coaching |
| Scoring | Model grading against a rubric | Transparent rule-based rubric (evaluated by `npm run eval`) |
| Voice | Gemini TTS directed by emotion (warm, curious, reassuring…) with natural pauses | Browser voice with the same emotion-aware pitch, pace and pauses |
| Coach chat | Model answers citing the knowledge base | Answers built from retrieved study notes, with sources |
| Planner | Tool-using agent | Same tools, rule-based planner |
| Retrieval | Hybrid: Postgres full-text + Gemini embeddings | Postgres full-text |

A circuit breaker (`lib/ai/availability.ts`) switches to offline content after repeated Gemini
failures and retries after a minute; the top bar shows **AI live / Offline mode**.

## AI architecture

- **Governed model client** — `frontend/lib/ai/gemini.ts`. Every call: PII masking → guardrail preamble →
  model fallback and circuit breaker → LangSmith trace (masked, with `usage_metadata` tokens) → audit row.
  Overloaded or rate-limited models are skipped immediately; when all fail, features degrade to the
  offline question bank and rule-based scoring.
- **Multi-agent group discussion** — four personas with fixed stances (`frontend/lib/gd/agents.ts`):
  **The Optimist** (innovation, adoption) and **The Skeptic** (edge cases, scalability, cost) argue opposite
  sides; **The Pragmatist** tests feasibility; **The Synthesizer** finds common ground. Each turn is a
  LangGraph state machine (`frontend/lib/ai/gd-agent-graph.ts`): `listen → gather → compose → review`,
  with a retry loop and an offline fallback node. The floor-lock state machine
  (`frontend/lib/gd/floor-control.ts`) enforces `OPEN → LOCKED` with every other participant `WAITING`;
  while a speaker holds the floor, the opposing persona listens and drafts its rebuttal from the live
  transcript (`frontend/lib/gd/conductor.ts`).
- **RAG** — `frontend/lib/rag/`: hybrid retrieval (Postgres full-text + Gemini embeddings, reciprocal rank
  fusion) → **cross-encoder reranking** (`rerank.ts`: `ms-marco-MiniLM-L-6-v2` locally via ONNX, or Cohere /
  Jina) → **sufficiency gate** → generation with **enforced citations** (`answer.ts`: every claim cites `[n]`;
  uncited or unsupported answers are declined as insufficient context).
- **Governance** — `frontend/lib/governance/pii-masker.ts`: user text is redacted at the API boundary and
  again before every database write (emails, phones, street addresses and PIN codes, Aadhaar, PAN, passport,
  voter ID, driving licence, SSN, cards, IPs, credentials); text sent to models or traces is additionally
  pseudonymised (including the user's name) and restored in replies. Prompt-injection guard and an
  `ai_events` audit log (no text stored).
- **Observability** — route-level traces for every AI route (`frontend/lib/server/api.ts`), token usage,
  and P50/P95 latency, error and fallback rates per feature (`frontend/lib/observability/metrics.ts`,
  `GET /api/observability`, shown in Settings → Privacy & AI). `LANGSMITH_*` and legacy
  `LANGCHAIN_TRACING_V2` / `LANGCHAIN_*` variables both work.
- **Agents** — the Prep Planner (`frontend/lib/agents/`) plans the week with read-only tools.

### Evals

| Command (from `frontend/`) | What it does |
| --- | --- |
| `npm run eval` | Retrieval hit@5/MRR, PII masking, injection detection, grader calibration, voice emotion |
| `npm run eval:rag` | `backend/evals/rag_eval.ts`: faithfulness, answer relevance, context recall, citation validity and decline accuracy on `backend/evals/rag_golden.json` (LLM judge with Gemini, heuristics offline) |
| `npm run eval:langsmith`, `npm run eval:rag -- --langsmith` | Same, uploaded to LangSmith as datasets and experiments |

## Requirements

- Node.js 20.19+ (22 LTS recommended)
- PostgreSQL 14+ (UTF-8 encoding)
- Optional: Firebase (sign-in), Gemini API key (live AI), LangSmith API key (tracing and eval experiments)

## Configuration

Copy `frontend/.env.example` to `frontend/.env.local`. Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config (Google, GitHub and phone sign-in) |
| `GEMINI_API_KEY` | Live AI. Without it the app runs in offline mode |
| `PII_MASKING`, `PII_STORAGE_REDACTION`, `AI_AUDIT_LOG` | Governance switches (default on; keep on in production) |
| `RERANKER`, `COHERE_API_KEY`, `JINA_API_KEY`, `RAG_MIN_RELEVANCE` | Reranker provider and the citation-sufficiency threshold |
| `ADMIN_EMAILS` | Accounts that see global AI health metrics |
| `LANGSMITH_*` or `LANGCHAIN_TRACING_V2` / `LANGCHAIN_*` | Tracing and evals |
| `DEV_AUTH_BYPASS`, `NEXT_PUBLIC_DEV_AUTH_BYPASS` | Local demo account; ignored in production |

For Google/GitHub sign-in, enable both providers under Firebase **Authentication → Sign-in method**
and add every domain you serve from under **Authentication → Settings → Authorized domains**
(`localhost` is included by default).

## Database workflow

| Task | Command |
| --- | --- |
| Create a migration after editing `prisma/schema.prisma` | `npm run db:migrate -- --name <change>` |
| Apply migrations in CI / production | `npm run db:deploy` |
| Re-seed practice questions and the knowledge base | `npm run db:seed` |
| Rebuild only the knowledge base (and embeddings) | `npm run rag:ingest` |
| Browse data | `npm run db:studio` |

## Quality checks

`npm run typecheck` · `npm run lint` · `npm test` (Vitest) · `npm run eval` · `npm run build`.
`.github/workflows/ci.yml` runs all of them against a Postgres service on every push.

## Deploying

**Vercel + Neon/Supabase (simplest)**

1. Create a Postgres database and set `DATABASE_URL` (pooled URL).
2. Import the repo in Vercel with **Root directory** `frontend` and **Build command** `npm run build:deploy`
   (generates the client, applies migrations, seeds, builds).
3. Add the environment variables above; set `NEXT_PUBLIC_SITE_URL` to your domain and
   `LANGSMITH_TRACING_BACKGROUND=false` if tracing.
4. Add the Vercel domain to Firebase **Authorized domains**.

**Docker (Render, Railway, Fly.io, a VM)**

```bash
docker build -t blackbox ./frontend \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=… --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=… \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=… --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=… \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your.domain
docker run -p 3000:3000 --env-file frontend/.env.production blackbox
```

The container applies migrations and seeds on start, and exposes a health check at `/api/health`.
`instrumentation.ts` logs configuration problems at startup. The in-memory rate limiter is per
instance; use a shared store (e.g. Redis) when running several.

## Project guide

`docs/Blackbox-Project-Guide.pdf` explains the project in plain language and technical terms. Its
source is `docs/project-guide.html`.
