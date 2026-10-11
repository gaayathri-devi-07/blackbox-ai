/**
 * Runs once when the server starts. Checks the environment so a bad deploy
 * fails loudly in the logs instead of surfacing as confusing runtime errors.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const production = process.env.NODE_ENV === "production";
  const problems: string[] = [];
  const notes: string[] = [];

  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set — every API route will fail.");
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && !process.env.FIREBASE_PROJECT_ID) {
    (production ? problems : notes).push("Firebase is not configured — Google/GitHub sign-in is disabled.");
  }
  if (production && process.env.DEV_AUTH_BYPASS === "true") notes.push("DEV_AUTH_BYPASS is ignored in production builds.");
  if (!process.env.GEMINI_API_KEY) notes.push("GEMINI_API_KEY is not set — running in offline mode (question bank + rule-based scoring).");
  if (process.env.PII_MASKING === "off") problems.push("PII_MASKING=off — personal data will be sent to AI providers unmasked.");
  const tracing = process.env.LANGSMITH_TRACING === "true" || process.env.LANGCHAIN_TRACING_V2 === "true";
  if (tracing && !process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) notes.push("LangSmith tracing is on but no API key is set — tracing disabled.");
  if (process.env.PII_STORAGE_REDACTION === "off") problems.push("PII_STORAGE_REDACTION=off — personal identifiers will be stored in the database.");
  if (production && !process.env.NEXT_PUBLIC_SITE_URL) notes.push("NEXT_PUBLIC_SITE_URL is not set — canonical links and the sitemap use localhost.");

  for (const p of problems) console.error(`[startup] ${p}`);
  for (const n of notes) console.warn(`[startup] ${n}`);
}
