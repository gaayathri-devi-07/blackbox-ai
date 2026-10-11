"use client";

/**
 * Typed fetch wrapper for the app's API routes.
 * - Attaches the caller's ID token (refreshing once on expiry).
 * - Enforces a timeout and surfaces a consistent ApiClientError.
 */

type TokenGetter = (forceRefresh?: boolean) => Promise<string | null>;

let getToken: TokenGetter = async () => null;

/** Registered by the AuthProvider once the session is known. */
export function setTokenGetter(getter: TokenGetter) {
  getToken = getter;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
  /** Defaults to 30 s; AI-backed calls pass longer values. */
  timeoutMs?: number;
}

async function send<T>(path: string, opts: RequestOptions, forceRefresh: boolean): Promise<T> {
  const token = await getToken(forceRefresh);
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 30_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    if ((error as Error).name === "TimeoutError" || timeout.aborted) {
      throw new ApiClientError(0, "TIMEOUT", "The request took too long. Please try again.");
    }
    throw new ApiClientError(0, "NETWORK", "Can't reach the server. Check your connection.");
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    if (res.status === 429) {
      throw new ApiClientError(429, "RATE_LIMITED", "You're going a little fast. Wait a moment and try again.");
    }
    throw new ApiClientError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status}).`, err?.details);
  }
  return data as T;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, opts, false);
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "TOKEN_EXPIRED") {
      return send<T>(path, opts, true);
    }
    throw error;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if ((error as Error)?.name === "AbortError") return "The request was cancelled.";
  return "Something went wrong. Please try again.";
}

/**
 * POST to a streaming route and return the raw Response (for audio streams).
 * Throws ApiClientError on non-2xx responses.
 */
export async function apiStream(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const token = await getToken(false);
  const res = await fetch(new URL(path, window.location.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiClientError(res.status, data?.error?.code ?? "HTTP_ERROR", data?.error?.message ?? `Request failed (${res.status}).`);
  }
  return res;
}
