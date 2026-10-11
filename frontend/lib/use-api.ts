"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";

type Query = Record<string, string | number | undefined | null>;

/** Fetch JSON from an API route with cancellation, error state and manual reload. */
export function useApi<T>(path: string | null, query?: Query) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Key of the last request that finished; loading is derived from it.
  const [settledKey, setSettledKey] = useState<string | null>(null);

  // A stable string key so callers can pass inline query objects.
  const queryKey = JSON.stringify(query ?? {});
  const requestKey = path ? `${path}|${queryKey}|${nonce}` : null;

  useEffect(() => {
    if (!path || !requestKey) return;
    const controller = new AbortController();
    api<T>(path, { query: JSON.parse(queryKey) as Query, signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSettledKey(requestKey);
      });
    return () => controller.abort();
  }, [path, queryKey, requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = requestKey !== null && settledKey !== requestKey;
  return { data, error: loading ? null : error, loading, reload, setData };
}
