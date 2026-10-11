import "server-only";

import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { User } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/server/errors";

/**
 * Firebase ID tokens are RS256 JWTs signed by Google. Verifying them against the
 * public JWKS needs only the project id — no service-account credentials.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
  { cacheMaxAge: 6 * 60 * 60 * 1000, cooldownDuration: 30_000, timeoutDuration: 5_000 }
);

export interface AuthIdentity {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** Local demo sign-in. Never honoured in production builds. */
export function devAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}

const DEV_TOKEN = /^dev:([a-z0-9-]{1,40})$/;

export async function verifyIdentity(req: NextRequest): Promise<AuthIdentity> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  const token = header.slice("Bearer ".length).trim();

  const dev = DEV_TOKEN.exec(token);
  if (dev) {
    if (!devAuthBypassEnabled()) {
      throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
    }
    return { uid: `dev-${dev[1]}`, email: `${dev[1]}@demo.local`, name: "Demo Candidate", picture: null };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new ApiError(500, "AUTH_NOT_CONFIGURED", "Authentication is not configured on the server.");
  }

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) {
      throw new ApiError(401, "INVALID_TOKEN", "Your session is invalid. Please sign in again.");
    }
    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof joseErrors.JWTExpired) {
      throw new ApiError(401, "TOKEN_EXPIRED", "Your session has expired. Please sign in again.");
    }
    throw new ApiError(401, "INVALID_TOKEN", "Your session is invalid. Please sign in again.");
  }
}

/** Resolve the caller to a database user, creating the row on first sign-in. */
export async function requireUser(req: NextRequest): Promise<User> {
  const identity = await verifyIdentity(req);

  const existing = await prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
  if (existing) return existing;

  try {
    return await prisma.user.create({
      data: {
        firebaseUid: identity.uid,
        email: identity.email,
        name: identity.name,
        photoUrl: identity.picture,
      },
    });
  } catch (error) {
    // Two concurrent first requests can race on the unique uid; the loser reads the winner's row.
    if ((error as { code?: string }).code === "P2002") {
      return prisma.user.findUniqueOrThrow({ where: { firebaseUid: identity.uid } });
    }
    throw error;
  }
}
