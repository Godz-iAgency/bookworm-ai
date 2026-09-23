import type { AiTask } from "./ai-models";
import { generationBudget } from "./generation-budget";
import { generateContent, type GeminiImage, type Provider } from "./gemini";
import { safeParseJson } from "./json";

/**
 * Generate from the model and parse it, retrying on failure. LLM JSON output
 * is occasionally malformed (an unescaped quote the sanitizer can't repair);
 * a fresh generation almost always comes back clean. Each attempt also gets
 * the Gemini->Groq fallback inside generateContent.
 *
 * A malformed-JSON failure needs different handling than a busy-server
 * failure. A fresh generation almost always fixes bad JSON, so retrying
 * instantly is right there. A 429 means the window is full right now, and a
 * 503 means Google's own model is temporarily overloaded (its documented
 * "high demand" response). Retrying instantly into either just repeats the
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

/** A parsed result, plus which provider and model actually produced it. */
export interface Generated<T> {
  data: T;
  provider: Provider;
  model: string;
}

export interface GenerateCallOptions {
  maxOutputTokens: number;
  /** Wall-clock allowance for every attempt together, fallback included. */
  budgetMs: number;
  attempts?: number;
  /**
   * Shape check, run inside the retry loop. Return a message to reject the
   * result and try again, or null to accept it.
   *
   * Parsing successfully is not the same as getting what was asked for. A run
   * that stops early can still produce valid JSON holding a fraction of the
   * request, and without this that fraction is indistinguishable from a good
   * result: a course with one of its seven days in it was saved to a reader's
   * shelf and looked finished. Validating here rather than at the call site
   * means a short result costs a retry instead of the whole generation.
   */
  validate?: (parsed: any) => string | null;
}

async function withRetries<T>(
  task: AiTask,
  opts: GenerateCallOptions,
  once: () => Promise<Generated<T>>
): Promise<Generated<T>> {
  const attempts = opts.attempts ?? 3;
  return generationBudget(opts.budgetMs, async () => {
    let lastError: any;
    for (let i = 0; i < attempts; i++) {
      try {
        const result = await once();
        const problem = opts.validate?.(result.data);
        if (problem) throw new Error(problem);
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[ai] ${task.name} attempt ${i + 1}/${attempts} failed:`, err?.message);
        if (i < attempts - 1 && needsBackoff(err)) {
          await sleep(1500 * (i + 1));
        }
      }
    }
    throw lastError ?? new Error("Generation failed.");
  });
}

export function generateJson(task: AiTask, userPrompt: string, systemPrompt: string, opts: GenerateCallOptions): Promise<Generated<any>> {
  return withRetries(task, opts, async () => {
    const r = await generateContent(task, userPrompt, systemPrompt, { json: true, maxOutputTokens: opts.maxOutputTokens });
    return { data: safeParseJson(r.text), provider: r.provider, model: r.model };
  });
}

/**
 * Plain-text generation, for the long lesson itself. A 4,000-word lesson as
 * one JSON string value is where a single unescaped quote costs the whole
 * generation, so the lesson is asked for as the bare text it already is.
 */
export function generateText(task: AiTask, userPrompt: string, systemPrompt: string, opts: GenerateCallOptions): Promise<Generated<string>> {
  return withRetries(task, opts, async () => {
    const r = await generateContent(task, userPrompt, systemPrompt, { maxOutputTokens: opts.maxOutputTokens });
    const text = r.text.replace(/^\s*```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
    return { data: text, provider: r.provider, model: r.model };
  });
}

/** Same contract as generateJson, for a call that attaches a photo. */
export function generateVisionJson(
  task: AiTask,
  userPrompt: string,
  systemPrompt: string,
  image: GeminiImage,
  opts: GenerateCallOptions
): Promise<Generated<any>> {
  return withRetries(task, opts, async () => {
    const r = await generateContent(task, userPrompt, systemPrompt, { json: true, maxOutputTokens: opts.maxOutputTokens, image });
    return { data: safeParseJson(r.text), provider: r.provider, model: r.model };
  });
}
