"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary: keeps the shell usable when a page crashes. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6">
        <AlertTriangle className="size-5 text-warning" />
        <h2 className="mt-3 text-base font-semibold">This page ran into a problem</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The error has been logged. You can retry, or return to the dashboard — your saved sessions are not affected.
        </p>
        {error.digest && <p className="mt-3 font-mono text-[11px] text-subtle">Reference: {error.digest}</p>}
        <div className="mt-5 flex gap-2">
          <Button size="sm" onClick={reset}>Try again</Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/home">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
