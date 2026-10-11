/**
 * PII masking middleware.
 *
 * Two policies built on the same detectors (lib/governance/pii.ts):
 *
 *   maskForModel     Reversible pseudonymisation for text sent to Gemini or
 *                    LangSmith. Values become [EMAIL_1], [NAME_1]…; the reply
 *                    is restored for the user. Used inside lib/ai/gemini.ts.
 *
 *   redactForStorage Irreversible redaction before anything is written to
 *                    PostgreSQL: emails, phone numbers, government IDs
 *                    (Aadhaar, PAN, passport, voter ID, driving licence, SSN),
 *                    card numbers, street addresses, PIN codes, IPs and
 *                    credentials become "[EMAIL REDACTED]" etc. Names are kept
 *                    so transcripts stay readable.
 *
 * Every user-supplied text — spoken-answer transcripts, chat messages,
 * discussion turns, project write-ups, practice answers — passes through
 * redactForStorage in lib/db.ts and the API routes before Prisma sees it.
 */
import { createVault, maskDeep, maskPii, type MaskOptions, type PiiKind } from "@/lib/governance/pii";

export type { PiiKind };

const LABEL: Record<PiiKind, string> = {
  SECRET: "CREDENTIAL",
  EMAIL: "EMAIL",
  ADDRESS: "ADDRESS",
  CARD: "CARD NUMBER",
  AADHAAR: "AADHAAR",
  PASSPORT: "PASSPORT",
  VOTER_ID: "VOTER ID",
  DRIVING_LICENCE: "DRIVING LICENCE",
  PAN: "PAN",
  SSN: "SSN",
  PHONE: "PHONE",
  IP: "IP ADDRESS",
  NAME: "NAME",
};

export interface RedactionResult {
  text: string;
  /** How many values of each kind were removed. */
  redacted: Partial<Record<PiiKind, number>>;
}

export function storageRedactionEnabled(): boolean {
  return process.env.PII_STORAGE_REDACTION !== "off";
}

/** Irreversibly remove personal identifiers (not names) from text before it is stored. */
export function redactForStorage(text: string): RedactionResult {
  if (!text || !storageRedactionEnabled()) return { text, redacted: {} };
  const { text: masked, found } = maskPii(text, { skip: ["NAME"] });
  const out = masked.replace(/\[([A-Z_]+)_\d+\]/g, (placeholder, kind: string) =>
    kind in LABEL ? `[${LABEL[kind as PiiKind]} REDACTED]` : placeholder
  );
  return { text: out, redacted: found };
}

/** Convenience: redacted text only. */
export function redact(text: string): string {
  return redactForStorage(text).text;
}

/** Redact every string in a JSON-like value (transcripts, turn arrays). */
export function redactDeep<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return redact(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    return v;
  };
  return walk(value) as T;
}

/** Reversible masking for model and trace payloads (see lib/ai/gemini.ts). */
export function maskForModel(text: string, options: MaskOptions = {}) {
  return maskPii(text, { ...options, vault: options.vault ?? createVault() });
}

export { maskDeep };
