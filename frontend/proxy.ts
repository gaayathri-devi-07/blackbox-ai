import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

// Global rate limit: 120 requests per minute per IP across all API routes
const GLOBAL_API_LIMIT = { limit: 120, windowMs: 60_000 };

// Tighter limit for AI-heavy endpoints (to protect API key spend)
const AI_ENDPOINT_LIMIT = { limit: 20, windowMs: 60_000 };

// Only writes to these routes call the model; reads (results, history) use the general limit.
const AI_ROUTES = ["/api/chat", "/api/interview", "/api/gd", "/api/project", "/api/practice", "/api/transcribe", "/api/agents"];

// Speech synthesis runs once per spoken line, so it gets its own, larger budget.
const TTS_LIMIT = { limit: 60, windowMs: 60_000 };

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  // ── 1. Redirect HTTP → HTTPS in production ──────────────────────────────────
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") === "http"
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ── 2. Rate limiting on all /api/ routes ────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const isTts = request.method === "POST" && pathname.startsWith("/api/tts");
    const isAiRoute = !isTts && request.method === "POST" && AI_ROUTES.some((r) => pathname.startsWith(r));
    const config = isTts ? TTS_LIMIT : isAiRoute ? AI_ENDPOINT_LIMIT : GLOBAL_API_LIMIT;
    const { allowed, remaining, resetAt } = checkRateLimit(
      `${ip}:${isTts ? "tts" : isAiRoute ? "ai" : "api"}`,
      config
    );

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please slow down." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
          },
        }
      );
    }

    // Attach rate limit headers to allowed responses
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(config.limit));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
    return response;
  }

  // ── 3. Block common attack path probes ──────────────────────────────────────
  const blocked = [
    "/wp-admin", "/wp-login", "/.env", "/config.php",
    "/admin.php", "/xmlrpc.php", "/.git", "/etc/passwd",
  ];
  if (blocked.some((b) => pathname.startsWith(b) || pathname.includes(b))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|mp3|ico|css|js)$).*)",
  ],
};
