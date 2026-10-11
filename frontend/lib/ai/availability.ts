import "server-only";

/**
 * Online / offline switch for the AI layer.
 *
 * With a Gemini key and a working connection, every feature is generated live.
 * When the key is missing, or Gemini keeps failing (no internet, quota, outage),
 * a circuit breaker opens and callers immediately use the curated question bank
 * and rule-based scoring instead of waiting on timeouts. After a cool-down the
 * next request probes Gemini again and closes the circuit if it succeeds.
 */

const FAILURE_THRESHOLD = 3;
const COOL_DOWN_MS = 60_000;

let consecutiveFailures = 0;
let openUntil = 0;
let lastSuccessAt = 0;
let lastFailureAt = 0;

export type AiMode = "live" | "degraded" | "offline";

export function aiKeyConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** True while Gemini is considered unreachable; skip the network call. */
export function circuitOpen(now = Date.now()): boolean {
  return now < openUntil;
}

export function recordAiSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
  lastSuccessAt = Date.now();
}

/** Count a connectivity-type failure (timeout, network, 429, 5xx). */
export function recordAiFailure(): void {
  consecutiveFailures++;
  lastFailureAt = Date.now();
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    openUntil = Date.now() + COOL_DOWN_MS;
    consecutiveFailures = 0;
  }
}

export function aiMode(): AiMode {
  if (!aiKeyConfigured()) return "offline";
  if (circuitOpen()) return "degraded";
  return "live";
}

export function aiStatus() {
  return {
    mode: aiMode(),
    keyConfigured: aiKeyConfigured(),
    lastSuccessAt: lastSuccessAt || null,
    lastFailureAt: lastFailureAt || null,
    retryAt: circuitOpen() ? openUntil : null,
  };
}

/** Test hook. */
export function resetAiCircuit(): void {
  consecutiveFailures = 0;
  openUntil = 0;
}
