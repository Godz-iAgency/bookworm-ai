import { generateGeminiContent, type GeminiImage } from "./gemini";
import { safeParseJson } from "./json";

/**
 * Generate structured JSON from the model and parse it, retrying on failure.
 * LLM JSON output is occasionally malformed (an unescaped quote the sanitizer
 * can't repair); a fresh generation almost always comes back clean. Each
 * attempt also benefits from the Gemini→Groq fallback inside
 * generateGeminiContent.
 *
 * 3 attempts, not 2: readers hitting "Could not parse generation output" were
 * having to tap "Try Again" themselves 2-3 times before it went through —
 * exactly the retries this function should have been doing on its own. All
 * three callers share this 60s route budget; 3 attempts still comfortably
 * fits it for the model latencies seen in practice.
 *
 * A malformed-JSON failure needs different handling than a busy-server
 * failure. A fresh generation almost always fixes bad JSON, so retrying
 * instantly is right there. A 429 means the window is full right now, and a
 * 503 means Google's own model is temporarily overloaded (its documented
 * "high demand" response) — retrying instantly into either just repeats the
 * same failure, and for a 429 it also burns the Gemini->Groq fallback along
 * with it, which is exactly what turned one rate-limited call into every call
 * in the same batch failing. Both back off instead.
 */
function needsBackoff(err: any): boolean {
  return (
    err?.status === 429 ||
    err?.status === 503 ||
    /too many requests|rate limit|unavailable|high demand/i.test(err?.message ?? "")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateJson(
  userPrompt: string,
  systemPrompt: string,
  maxOutputTokens: number,
  attempts = 3,
  /**
   * Optional shape check, run inside the retry loop. Return a message to reject
   * the result and try again, or null to accept it.
   *
   * Parsing successfully is not the same as getting what was asked for. A run
   * that stops early can still produce valid JSON holding a fraction of the
   * request, and without this that fraction is indistinguishable from a good
   * result: a course with one of its seven days in it was saved to a reader's
   * shelf and looked finished. Validating here rather than at the call site
   * means a short result costs a retry instead of the whole generation.
   */
  validate?: (parsed: any) => string | null
): Promise<any> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await generateGeminiContent(userPrompt, systemPrompt, true, maxOutputTokens, 0);
      const parsed = safeParseJson(raw);
      const problem = validate?.(parsed);
      if (problem) throw new Error(problem);
      return parsed;
    } catch (err: any) {
      lastError = err;
      console.warn(`generateJson attempt ${i + 1}/${attempts} failed:`, err?.message);
      if (i < attempts - 1 && needsBackoff(err)) {
        await sleep(1500 * (i + 1));
      }
    }
  }
  throw lastError ?? new Error("Generation failed.");
}

/**
 * Same contract as generateJson, for a call that attaches a photo. Kept
 * separate rather than folding an optional image into generateJson: every
 * existing caller of that function is text-only, and threading an unused
 * image param through all of them for the one caller that needs it isn't
 * worth the churn.
 */
export async function generateVisionJson(
  userPrompt: string,
  systemPrompt: string,
  image: GeminiImage,
  maxOutputTokens: number,
  attempts = 3
): Promise<any> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await generateGeminiContent(userPrompt, systemPrompt, true, maxOutputTokens, 0, image);
      return safeParseJson(raw);
    } catch (err: any) {
      lastError = err;
      console.warn(`generateVisionJson attempt ${i + 1}/${attempts} failed:`, err?.message);
      if (i < attempts - 1 && needsBackoff(err)) {
        await sleep(1500 * (i + 1));
      }
    }
  }
  throw lastError ?? new Error("Generation failed.");
}
