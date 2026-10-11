import { z } from "zod";
import { authedRoute, ApiError, parseBody } from "@/lib/server/api";
import { AIUnavailableError, GEMINI_VOICES, streamSpeech } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  text: z.string().trim().min(1).max(1200),
  voice: z.enum(GEMINI_VOICES),
  style: z.string().trim().max(700).optional(),
});

/**
 * POST /api/tts/stream — raw 16-bit little-endian PCM, mono, streamed as Gemini
 * produces it. The sample rate is in the X-Sample-Rate header. The client plays
 * chunks back to back with Web Audio, so speech starts about a second after the
 * request and the avatar's mouth moves only while sound is actually playing.
 */
export const POST = authedRoute(async ({ req }) => {
  const { text, voice, style } = await parseBody(req, schema, 8 * 1024);
  let speech: Awaited<ReturnType<typeof streamSpeech>>;
  try {
    speech = await streamSpeech(text, voice, style, req.signal);
  } catch (error) {
    if (error instanceof AIUnavailableError) throw new ApiError(503, "TTS_UNAVAILABLE", "AI voice is unavailable right now.");
    throw error;
  }
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await speech.chunks.next();
        if (done) controller.close();
        else controller.enqueue(new Uint8Array(value));
      } catch {
        controller.close();
      }
    },
    async cancel() {
      await speech.chunks.return(undefined);
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Sample-Rate": String(speech.sampleRate),
    },
  });
});
