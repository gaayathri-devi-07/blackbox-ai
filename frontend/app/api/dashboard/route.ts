import { authedRoute } from "@/lib/server/api";
import { getDashboard } from "@/lib/db";

export const runtime = "nodejs";

/** Track-aware readiness metrics, trends and recommended next actions. */
export const GET = authedRoute(async ({ user }) => getDashboard(user));
