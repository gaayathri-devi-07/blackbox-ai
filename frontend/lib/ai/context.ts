import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request AI context. The API wrapper opens it with the signed-in user, so
 * every model call made while handling the request can be attributed in the
 * audit log, masked with the user's own name, and grouped in traces — without
 * threading these values through every function.
 */
export interface AiContext {
  userId?: string;
  requestId?: string;
  /** Product feature, e.g. "interview" or "coach.chat". */
  feature: string;
  /** Personal names to pseudonymise before text leaves the server. */
  names?: (string | null | undefined)[];
}

const storage = new AsyncLocalStorage<AiContext>();

export function runWithAiContext<T>(ctx: AiContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getAiContext(): AiContext | undefined {
  return storage.getStore();
}

/** Narrow the feature label for a block of work (keeps user and request). */
export function withFeature<T>(feature: string, fn: () => T): T {
  const current = storage.getStore();
  return storage.run({ ...(current ?? {}), feature }, fn);
}

/** "/api/interview" → "interview", "/api/agents/plan" → "agents.plan". */
export function featureFromPath(pathname: string): string {
  return pathname.replace(/^\/api\//, "").replace(/\/+$/, "").replace(/\//g, ".") || "api";
}
