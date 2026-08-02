import { generateGeminiContent } from "./gemini";
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
 */
export async function generateJson(
  userPrompt: string,
  systemPrompt: string,
  maxOutputTokens: number,
  attempts = 3
): Promise<any> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await generateGeminiContent(userPrompt, systemPrompt, true, maxOutputTokens, 0);
      return safeParseJson(raw);
    } catch (err: any) {
      lastError = err;
      console.warn(`generateJson attempt ${i + 1}/${attempts} failed:`, err?.message);
    }
  }
  throw lastError ?? new Error("Generation failed.");
}
