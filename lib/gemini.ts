import type { AiTask } from "./ai-models";
import { providerSignal } from "./generation-budget";
import { generateGroqContent, groqModelName } from "./groq";

/** An inline image attached to a Gemini call, base64-encoded with no data-URL prefix. */
export interface GeminiImage {
  mimeType: string;
  data: string;
}

export type Provider = "gemini" | "groq";

/** What was generated, and by whom. Nothing downstream may assume Gemini. */
export interface GenerationResult {
  text: string;
  provider: Provider;
  model: string;
}

export interface GenerateOptions {
  json?: boolean;
  maxOutputTokens?: number;
  image?: GeminiImage;
}

/**
 * Google's error bodies quote the API key back ("Consumer 'api_key:...' has
 * been suspended"). Scrubbed before anything is logged or attached to an error.
 */
function redact(text: string): string {
  // Covers both key formats: the older "AIza..." and the newer dotted "AQ.Ab8..." ones.
  return text
    .replace(/api_key:[^'"\s]+/g, "api_key:[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/\bAQ\.[0-9A-Za-z_.-]{20,}/g, "[redacted]");
}

/** Direct call to the task's Gemini model. Throws on any failure. */
async function callGemini(task: AiTask, prompt: string, systemPrompt: string | undefined, opts: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Image first, then the instruction, matching Gemini's own recommended
  // ordering for a single-image prompt.
  const parts: any[] = [];
  if (opts.image) parts.push({ inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } });
  parts.push({ text: prompt });

  const payload: any = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      thinkingConfig: { thinkingLevel: task.thinking },
    },
  };

  if (systemPrompt) {
    payload.system_instruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${task.model}:generateContent?key=${apiKey}`, {
    method: "POST",
    signal: providerSignal(task.callTimeoutMs),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = redact(await res.text());
    let reason = "";
    let message = res.statusText;
    let quotaId = "";
    try {
      const body = JSON.parse(errorText);
      message = body?.error?.message ?? message;
      reason = body?.error?.details?.find((d: any) => d?.reason)?.reason ?? body?.error?.status ?? "";
      quotaId = body?.error?.details?.flatMap((d: any) => d?.violations ?? []).map((v: any) => v?.quotaId).find(Boolean) ?? "";
    } catch {}
    console.error(`[ai] ${task.name}: ${task.model} returned ${res.status} ${reason} ${quotaId}`.trim(), errorText);
    // Status carried on the error so callers can tell a rate limit (retry
    // later helps) apart from a real failure (retrying immediately won't).
    throw Object.assign(new Error(`Gemini API failed: ${res.status} ${reason || message}`), {
      status: res.status,
      reason,
      quotaId,
      detail: message,
    });
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  // Gemini 3 can split one answer across several parts, and thought summaries
  // arrive as parts too. Only the non-thought text is the answer.
  const text = (candidate?.content?.parts ?? [])
    .filter((p: any) => typeof p?.text === "string" && !p.thought)
    .map((p: any) => p.text)
    .join("");

  if (!text) {
    throw new Error("Gemini API returned empty response.");
  }

  /**
   * A run that stopped early still returns usable-looking text, and in JSON
   * mode it can even still parse: the model closes the object it is inside and
   * the result is valid JSON that is simply missing most of what was asked for.
   * That produced a course with one day in it and no flashcards, which reached
   * the reader looking like a finished course rather than a failed generation.
   * Treating it as a failure lets the caller retry instead.
   */
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    const usage = data.usageMetadata ?? {};
    console.error(
      `[ai] ${task.name}: ${task.model} stopped early: ${finishReason}`,
      `(prompt ${usage.promptTokenCount ?? "?"}, output ${usage.candidatesTokenCount ?? "?"},`,
      `thinking ${usage.thoughtsTokenCount ?? "?"}, limit ${opts.maxOutputTokens ?? "default"})`
    );
    throw new Error(`Gemini stopped early (${finishReason}).`);
  }

  return text;
}

/**
 * Generate with the task's Gemini model, retrying brief overloads, then its
 * backup Gemini model if it has one, and Groq only if Gemini still fails
 * (error, rate limit, timeout, empty response). The result always says
 * which provider and model actually produced it, and a fallback is logged
 * loudly with Google's own error, so a Groq answer is never mistaken for a
 * Gemini one.
 *
 * The fallback is text-only. A request carrying an image has nothing Groq can
 * do with it, so it skips straight to the original Gemini error rather than
 * sending Groq a prompt that silently drops the photo and answers about
 * nothing.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Worth retrying in a few seconds. A spent daily quota is not: it stays spent until it resets. */
const isTransient = (err: any) =>
  err?.status === 503 || err?.status === 500 || (err?.status === 429 && !/PerDay/i.test(err?.quotaId ?? ""));

export async function generateContent(
  task: AiTask,
  prompt: string,
  systemPrompt?: string,
  opts: GenerateOptions = {}
): Promise<GenerationResult> {
  const chain = [
    { model: task.model, retries: task.geminiRetries },
    ...(task.fallbackModel ? [{ model: task.fallbackModel, retries: 1 }] : []),
  ];
  let lastError: any;
  for (const { model, retries } of chain) {
    for (let attempt = 0; ; attempt++) {
      try {
        const text = await callGemini({ ...task, model }, prompt, systemPrompt, opts);
        if (model !== task.model) {
          console.warn(`[ai] ${task.name}: ${task.model} unavailable (${lastError?.message}). Served by backup Gemini model ${model}.`);
        }
        return { text, provider: "gemini", model };
      } catch (err: any) {
        lastError = err;
        if (attempt < retries && isTransient(err)) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        break;
      }
    }
  }

  const hasGroq = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
  if (!hasGroq || opts.image) throw lastError;
  const model = groqModelName();
  console.warn(`[ai] ${task.name}: Gemini unavailable (${lastError?.message}). Serving this request from the Groq fallback (${model}).`);
  const text = await generateGroqContent(prompt, systemPrompt, !!opts.json, opts.maxOutputTokens, task.callTimeoutMs);
  return { text, provider: "groq", model };
}
