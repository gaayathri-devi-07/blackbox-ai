import { z } from "zod";
import { authedRoute, ApiError, parseBody } from "@/lib/server/api";
import { AIUnavailableError, GEMINI_VOICES, aiConfigured, synthesizeSpeech } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  voice: z.enum(GEMINI_VOICES),
  style: z.string().trim().max(700).optional(),
});

/** Whether AI voices are available (a Gemini key is configured). */
export const GET = authedRoute(async () => ({ available: aiConfigured() && process.env.GEMINI_TTS !== "off" }));

/** Natural AI speech for interviewer, moderator and panelist lines. */
export const POST = authedRoute(async ({ req }) => {
  const { text, voice, style } = await parseBody(req, ttsSchema, 4 * 1024);
  try {
    return await synthesizeSpeech(text, voice, style);
  } catch (error) {
    if (error instanceof AIUnavailableError) throw new ApiError(503, "TTS_UNAVAILABLE", "AI voice is unavailable right now.");
    throw error;
  }
});
