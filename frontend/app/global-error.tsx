"use client";

/** Last-resort boundary for errors in the root layout itself. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#16181c", color: "#eceef1" }}>
        <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Blackbox is temporarily unavailable</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a3a9b3" }}>
              An unexpected error occurred while loading the application. Please try again.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 12, padding: "8px 14px", borderRadius: 6, border: 0, background: "#eceef1", color: "#16181c", fontWeight: 500, cursor: "pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
