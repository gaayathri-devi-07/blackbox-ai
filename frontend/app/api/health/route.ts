import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiStatus } from "@/lib/ai/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness + dependency check for load balancers and uptime monitors. */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "unavailable" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }
  return NextResponse.json(
    { status: database === "ok" ? "ok" : "degraded", database, ai: aiStatus(), latencyMs: Date.now() - started },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
