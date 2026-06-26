import { generateGeminiContent } from "./gemini";
import { safeParseJson } from "./json";

/**
 * Generate structured JSON from the model and parse it, retrying on failure.
 * LLM JSON output is occasionally malformed (an unescaped quote the sanitizer
 * can't repair); a fresh generation almost always comes back clean. Each
 * attempt also benefits from the Gemini→Groq fallback inside
 * generateGeminiContent.
 */
export async function generateJson(
  userPrompt: string,
  systemPrompt: string,
  maxOutputTokens: number,
  attempts = 2
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
