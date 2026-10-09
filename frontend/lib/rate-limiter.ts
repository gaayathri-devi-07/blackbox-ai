/**
 * In-memory IP-based rate limiter for Next.js API routes.
 * Tracks request counts per IP in a sliding window.
 * Auto-cleans stale entries every 5 minutes to avoid memory leaks.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > 60_000) {
        store.delete(key);
      }
    }
  }, 5 * 60_000);
}

export interface RateLimitConfig {
  /** Maximum requests allowed per window */
  limit: number;
  /** Window size in milliseconds (default: 60 000 = 1 minute) */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if the given identifier (IP address) is within rate limits.
 * Returns whether the request is allowed and metadata for response headers.
 */
export function checkRateLimit(
  identifier: string,
  { limit, windowMs = 60_000 }: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const resetAt = entry.windowStart + windowMs;

  return { allowed: entry.count <= limit, remaining, resetAt };
}

/**
 * Extract the client IP from a Next.js Request object.
 * Checks standard proxy headers before falling back to a placeholder.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
