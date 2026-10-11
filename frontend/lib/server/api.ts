import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import type { User } from "@/lib/generated/prisma/client";
import { requireUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { featureFromPath, runWithAiContext } from "@/lib/ai/context";
import { redactDeep } from "@/lib/governance/pii-masker";
import { traced } from "@/lib/observability/tracing";

/** Routes that call models: each request becomes one root trace in LangSmith. */
const TRACED_ROUTES = ["/api/chat", "/api/interview", "/api/gd", "/api/agents", "/api/project", "/api/practice", "/api/transcribe", "/api/tts"];

export { ApiError };

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown; requestId: string };
}

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

/**
 * Read, size-check and validate a JSON request body.
 * Throws ApiError(413 | 400 | 422) so handlers stay linear.
 */
export async function parseBody<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
  opts: { redact?: boolean } = {}
): Promise<z.infer<S>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
  }

  const raw = await req.text();
  if (raw.length > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${maxBytes} bytes.`);
  }

  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }

  const data = validate(schema, json);
  // PII governance: user-written text is redacted at the boundary, so models,
  // traces and the database only ever see the redacted version.
  return opts.redact ? redactDeep(data) : data;
}

/** Validate query-string parameters against a schema. */
export function parseQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const params: Record<string, string | string[]> = {};
  for (const key of new Set(req.nextUrl.searchParams.keys())) {
    const values = req.nextUrl.searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  return validate(schema, params);
}

function validate<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      "The request contains invalid fields.",
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    );
  }
  return result.data;
}

interface HandlerContext {
  req: NextRequest;
  user: User;
  requestId: string;
}

type Handler = (ctx: HandlerContext) => Promise<unknown>;

/**
 * Wrap a route handler with authentication, error mapping and request ids.
 * Returning a plain object sends it as JSON; returning a Response passes it through.
 */
export function authedRoute(handler: Handler) {
  return async (req: NextRequest): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const user = await requireUser(req);
      // Every model call made while handling this request is attributed to the
      // user and feature, and masks the user's own name (see lib/ai/gemini.ts).
      const path = req.nextUrl.pathname;
      const run = () => handler({ req, user, requestId });
      const result = await runWithAiContext(
        { userId: user.id, requestId, feature: featureFromPath(path), names: [user.name] },
        // Tracing middleware: the route is the parent run; retrieval, model calls,
        // tool calls and their token usage nest under it (all masked).
        () =>
          TRACED_ROUTES.some((r) => path.startsWith(r)) && req.method !== "GET"
            ? traced(`${req.method} ${path}`, "chain", { path, method: req.method, requestId }, run, { route: path })
            : run()
      );
      if (result instanceof Response) {
        result.headers.set("x-request-id", requestId);
        return result;
      }
      return NextResponse.json(result ?? { ok: true }, {
        headers: { "Cache-Control": "no-store", "x-request-id": requestId },
      });
    } catch (error) {
      return errorResponse(error, requestId, req);
    }
  };
}

function errorResponse(error: unknown, requestId: string, req: NextRequest): Response {
  const mapped = mapError(error);
  if (mapped.status >= 500) {
    console.error(`[api] ${req.method} ${req.nextUrl.pathname} ${requestId}`, error);
  }
  const body: ApiErrorBody = {
    error: { code: mapped.code, message: mapped.message, details: mapped.details, requestId },
  };
  return NextResponse.json(body, {
    status: mapped.status,
    headers: { "Cache-Control": "no-store", "x-request-id": requestId },
  });
}

function mapError(error: unknown): { status: number; code: string; message: string; details?: unknown } {
  if (error instanceof ApiError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details };
  }

  // Database connectivity problems surface from node-postgres or Prisma init.
  const err = error as { code?: string; name?: string } | undefined;
  if (
    err?.name === "PrismaClientInitializationError" ||
    err?.code === "ECONNREFUSED" ||
    err?.code === "P1001" ||
    err?.code === "ETIMEDOUT"
  ) {
    return {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "The database is temporarily unavailable. Please try again shortly.",
    };
  }
  if (err?.code === "P2025") {
    return { status: 404, code: "NOT_FOUND", message: "The requested record does not exist." };
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." };
}
