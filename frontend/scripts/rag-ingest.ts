/**
 * Rebuild the RAG knowledge base: `npm run rag:ingest`.
 * Re-embeds changed chunks when GEMINI_API_KEY is set.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { syncKnowledgeBase } from "../lib/rag/sync";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const report = await syncKnowledgeBase(prisma, { log: (m) => console.log(m), waitOnRateLimit: true });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
