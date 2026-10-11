import { z } from "zod";
import { authedRoute, ApiError, parseBody } from "@/lib/server/api";
import { AIUnavailableError, aiConfigured, transcribeAudio } from "@/lib/ai/gemini";
import { redact } from "@/lib/governance/pii-masker";

export const runtime = "nodejs";
export const maxDuration = 40;

// 4 minutes of 16 kHz mono 16-bit WAV is ~7.7 MB, ~10.3 MB as base64.
const MAX_AUDIO_BASE64 = 10_400_000;

const transcribeSchema = z.object({
  audio: z.string().min(100).max(MAX_AUDIO_BASE64).regex(/^[A-Za-z0-9+/=]+$/, "Audio must be base64."),
  accent: z.string().trim().max(40).optional(),
  question: z.string().trim().max(1000).optional(),
});

/**
 * Accurate transcript of a recorded answer. The audio is processed in memory
 * and never stored. Returns 503 when no Gemini key is configured, in which
 * case the client keeps its live browser transcript.
 */
export const POST = authedRoute(async ({ req }) => {
  if (!aiConfigured()) throw new ApiError(503, "TRANSCRIPTION_UNAVAILABLE", "Server transcription is not configured.");
  const { audio, accent, question } = await parseBody(req, transcribeSchema, MAX_AUDIO_BASE64 + 4096);
  try {
    // Spoken answers are redacted before they reach the client, the database or any model.
    return { text: redact(await transcribeAudio(audio, { accent, context: question })) };
  } catch (error) {
    if (error instanceof AIUnavailableError) throw new ApiError(503, "TRANSCRIPTION_UNAVAILABLE", "Transcription is unavailable right now.");
    throw error;
  }
});
