/** Canonical public origin, e.g. https://blackbox.example.com (no trailing slash). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** Pages anyone can visit; everything else requires an account. */
export const PUBLIC_PATHS = ["/login", "/terms", "/privacy"] as const;
