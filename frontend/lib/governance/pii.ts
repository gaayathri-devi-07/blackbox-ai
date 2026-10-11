/**
 * PII masking (reversible pseudonymisation).
 *
 * Every piece of text that leaves our servers — prompts to Gemini, traces to
 * LangSmith, audit logs — goes through `maskPii` first. Detected values are
 * replaced with typed placeholders such as [EMAIL_1]; the mapping (the "vault")
 * stays in memory for the duration of one request so the model's reply can be
 * restored with `unmaskPii` before it is shown to the candidate.
 *
 * Detectors are deterministic and validated where a checksum exists (Luhn for
 * cards, Verhoeff for Aadhaar) to keep false positives on numbers that appear
 * in technical answers — years, latencies, big-O — close to zero.
 */

export type PiiKind =
  | "SECRET"
  | "EMAIL"
  | "ADDRESS"
  | "CARD"
  | "AADHAAR"
  | "PASSPORT"
  | "VOTER_ID"
  | "DRIVING_LICENCE"
  | "PAN"
  | "SSN"
  | "PHONE"
  | "IP"
  | "NAME";

export const PII_KINDS: PiiKind[] = [
  "SECRET",
  "EMAIL",
  "ADDRESS",
  "CARD",
  "AADHAAR",
  "PASSPORT",
  "VOTER_ID",
  "DRIVING_LICENCE",
  "PAN",
  "SSN",
  "PHONE",
  "IP",
  "NAME",
];

export interface PiiVault {
  /** placeholder → original value */
  byPlaceholder: Map<string, string>;
  /** `${kind}:${normalised value}` → placeholder, so repeats share one placeholder */
  byValue: Map<string, string>;
  counters: Partial<Record<PiiKind, number>>;
}

export interface MaskOptions {
  /** Known personal names (e.g. the candidate's own) to pseudonymise. */
  names?: (string | null | undefined)[];
  /** Kinds to leave untouched, e.g. NAME for speech synthesis. */
  skip?: PiiKind[];
  /** Share placeholders across several strings of the same request. */
  vault?: PiiVault;
}

export interface MaskResult {
  text: string;
  vault: PiiVault;
  /** How many values of each kind were masked in this string. */
  found: Partial<Record<PiiKind, number>>;
}

export function createVault(): PiiVault {
  return { byPlaceholder: new Map(), byValue: new Map(), counters: {} };
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Aadhaar numbers carry a Verhoeff check digit. */
export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
}

// ─── Detectors ────────────────────────────────────────────────────────────────

interface Detector {
  kind: PiiKind;
  pattern: RegExp;
  /** Return false to reject a regex match (checksum, context). */
  accept?: (match: string) => boolean;
  normalise?: (match: string) => string;
  /** Mask only this capture group (the cue words around it stay readable). */
  group?: number;
}

const STREET_WORDS =
  "Street|St\\.?|Road|Rd\\.?|Avenue|Ave\\.?|Lane|Ln\\.?|Nagar|Marg|Colony|Layout|Cross|Main|Boulevard|Blvd\\.?|Drive|Dr\\.?|Salai|Sector|Block|Phase|Enclave|Extension|Ext\\.?";

const digitsOf = (s: string) => s.replace(/\D/g, "");

const DETECTORS: Detector[] = [
  {
    // API keys and bearer credentials that people paste into project write-ups.
    kind: "SECRET",
    pattern:
      /\b(?:AIza[0-9A-Za-z_-]{30,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g,
  },
  {
    kind: "EMAIL",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    normalise: (m) => m.toLowerCase(),
  },
  {
    // "my address is 12 MG Road, Bengaluru 560001", "I live at Flat 4B, …"
    kind: "ADDRESS",
    pattern:
      /\b(?:[Mm]y (?:home |house |current |permanent |residential )?address is|I (?:live|stay|reside) (?:at|in)|I'm (?:staying|living) (?:at|in)|[Rr]esiding at)\s+((?:[A-Z0-9#][\w.#/'-]*[\s,]*){1,10})/g,
    group: 1,
  },
  {
    // 42 Residency Road, Bengaluru 560025 · 221B Baker Street · 7/3 2nd Cross, Indiranagar
    kind: "ADDRESS",
    pattern: new RegExp(
      `\\b\\d{1,5}[A-Za-z]?(?:/\\d+)?,?\\s+(?:\\d{1,2}(?:st|nd|rd|th)\\s+)?(?:[A-Z][\\w.'-]*\\s+){0,4}(?:${STREET_WORDS})\\b(?:[,\\s]+[A-Z][\\w.-]*){0,4}(?:[,\\s-]+\\d{5,6})?`,
      "g"
    ),
  },
  {
    // Flat 12B, Lake View Apartments, Powai, Mumbai 400076
    kind: "ADDRESS",
    pattern: /\b(?:[Ff]lat|[Hh]ouse|[Hh]\.?\s?[Nn]o|[Dd]oor\s?[Nn]o|[Pp]lot|[Aa]partment|[Aa]pt)\.?\s*(?:[Nn]o\.?\s*)?[\w/-]{1,8}\b[^.\n]{0,100}?\b\d{6}\b/g,
  },
  { kind: "ADDRESS", pattern: /\b(?:pin\s?code|postal\s+code|zip\s?code|pin|zip)\s*[:-]?\s*(\d{5,6})\b/gi, group: 1 },
  {
    kind: "CARD",
    pattern: /\b\d(?:[ -]?\d){12,18}\b/g,
    accept: (m) => luhnValid(digitsOf(m)) && !/^(\d)\1+$/.test(digitsOf(m)),
    normalise: digitsOf,
  },
  {
    kind: "AADHAAR",
    pattern: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g,
    accept: (m) => verhoeffValid(digitsOf(m)),
    normalise: digitsOf,
  },
  // Passport numbers (Indian format A1234567) only when named, to avoid masking codes.
  { kind: "PASSPORT", pattern: /\b[Pp]assport(?:\s+(?:[Nn]o\.?|[Nn]umber))?\s*(?:is|:|-|#)?\s*([A-Z][0-9]{7})\b/g, group: 1 },
  // Voter ID (EPIC): three letters and seven digits.
  { kind: "VOTER_ID", pattern: /\b[A-Z]{3}[0-9]{7}\b/g },
  // Driving licence: state code, RTO code, year, serial (TN-01-2019-1234567).
  { kind: "DRIVING_LICENCE", pattern: /\b[A-Z]{2}[-\s]?\d{2}[-\s]?(?:19|20)\d{2}[-\s]?\d{7}\b/g },
  { kind: "PAN", pattern: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g },
  { kind: "SSN", pattern: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  {
    // +91 98765 43210, (415) 555-0123, 98765-43210, +44 20 7946 0958 …
    kind: "PHONE",
    pattern: /(?<![\w.])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,5}(?:[\s.-]?\d{2,5}){1,3}(?!\w|\.\d)/g,
    accept: (m) => {
      const d = digitsOf(m);
      if (d.length < 10 || d.length > 13) return false;
      if (m.trim().startsWith("+")) return true;
      if (d.length === 10 && /^[6-9]/.test(d)) return true; // Indian mobile
      if (d.length === 10 && /^\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}$/.test(m.trim())) return true; // NANP
      return /^0\d{9,11}$/.test(d) && /[\s-]/.test(m); // trunk-prefixed landlines
    },
    normalise: (m) => digitsOf(m).slice(-10),
  },
  {
    kind: "IP",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    // Leave loopback, private ranges and version-like strings alone.
    accept: (m) => !/^(?:127\.|10\.|192\.168\.|0\.)/.test(m),
  },
];

/** "my name is Priya Sharma" / "I'm Rahul" — names a candidate states about themselves. */
const SELF_INTRO = /\b(?:[Mm]y name is|I am called|I'm|I am|[Mm]yself)\s+([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20}){0,2})\b/g;
const NOT_NAMES = new Set([
  "Here", "Ready", "Sure", "Good", "Fine", "Not", "Very", "Currently", "Working", "Interested", "Looking", "Happy", "Glad",
  "A", "An", "The", "Also", "Just", "Really", "Excited", "Passionate", "Confident", "Comfortable", "Familiar", "Sorry",
  "Indian", "From", "Based", "Applying", "Planning", "Trying", "Going", "Able", "Responsible", "Leading", "Building",
]);

function placeholderFor(vault: PiiVault, kind: PiiKind, original: string, normalised: string): string {
  const key = `${kind}:${normalised}`;
  const existing = vault.byValue.get(key);
  if (existing) return existing;
  const n = (vault.counters[kind] ?? 0) + 1;
  vault.counters[kind] = n;
  const placeholder = `[${kind}_${n}]`;
  vault.byValue.set(key, placeholder);
  vault.byPlaceholder.set(placeholder, original);
  return placeholder;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function maskPii(input: string, options: MaskOptions = {}): MaskResult {
  const vault = options.vault ?? createVault();
  const skip = new Set(options.skip ?? []);
  const found: Partial<Record<PiiKind, number>> = {};
  if (!input) return { text: input, vault, found };
  let text = input;

  const bump = (kind: PiiKind) => (found[kind] = (found[kind] ?? 0) + 1);

  for (const d of DETECTORS) {
    if (skip.has(d.kind)) continue;
    text = text.replace(d.pattern, (match: string, ...groups: unknown[]) => {
      // Never re-mask an existing placeholder.
      if (/^\[[A-Z_]+_\d+\]$/.test(match)) return match;
      const target = d.group ? (groups[d.group - 1] as string | undefined)?.replace(/[\s,]+$/, "") : match;
      if (!target || /^\[[A-Z_]+_\d+\]$/.test(target)) return match;
      if (d.accept && !d.accept(target)) return match;
      bump(d.kind);
      const placeholder = placeholderFor(vault, d.kind, target, d.normalise ? d.normalise(target) : target);
      return d.group ? match.replace(target, placeholder) : placeholder;
    });
  }

  if (!skip.has("NAME")) {
    const names = new Set<string>();
    for (const n of options.names ?? []) {
      const clean = n?.trim();
      if (!clean || clean.length < 2) continue;
      names.add(clean);
      // Also catch the first and last name on their own.
      for (const part of clean.split(/\s+/)) if (part.length >= 3) names.add(part);
    }
    // Longest first so "Priya Sharma" wins over "Priya".
    for (const name of [...names].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(?<![\\w\\[])${escapeRegExp(name)}(?![\\w\\]])`, "gi");
      text = text.replace(re, (match) => {
        bump("NAME");
        return placeholderFor(vault, "NAME", match, match.toLowerCase());
      });
    }
    text = text.replace(SELF_INTRO, (whole, name: string) => {
      const first = name.split(/\s+/)[0];
      if (NOT_NAMES.has(first)) return whole;
      bump("NAME");
      return whole.replace(name, placeholderFor(vault, "NAME", name, name.toLowerCase()));
    });
  }

  return { text, vault, found };
}

/** Restore original values in a model reply. Unknown placeholders are left as they are. */
export function unmaskPii(text: string, vault: PiiVault): string {
  if (!text || vault.byPlaceholder.size === 0) return text;
  return text.replace(/\[([A-Z_]+)_(\d+)\]/g, (placeholder) => vault.byPlaceholder.get(placeholder) ?? placeholder);
}

/** Total number of values masked so far in a vault. */
export function vaultSize(vault: PiiVault): number {
  return vault.byPlaceholder.size;
}

/** Counts per kind for a vault, for audit logs (never the values). */
export function vaultSummary(vault: PiiVault): Partial<Record<PiiKind, number>> {
  return { ...vault.counters };
}

/** Recursively mask every string in a JSON-like value (used for trace payloads). */
export function maskDeep<T>(value: T, options: MaskOptions = {}): T {
  const vault = options.vault ?? createVault();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return maskPii(v, { ...options, vault }).text;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, walk(val)]));
    return v;
  };
  return walk(value) as T;
}
