import { providerSignal } from "./generation-budget";
/**
 * Groq fallback model (free tier). Used automatically when the primary Gemini
 * call fails. Groq's API is OpenAI-compatible.
 *
 * Default model is openai/gpt-oss-120b, overridable via GROQ_MODEL. This used
 * to default to llama-3.3-70b-versatile, which Groq has since retired
 * entirely - it no longer appears in this account's model list at all, so
 * every fallback call failed with a flat 404 "model_not_found", which is what
 * turned an ordinary Gemini hiccup into a hard failure with no safety net.
 * Verified live against Groq's own /models endpoint and a real JSON-mode call
 * before picking this replacement, rather than guessing a name.
 */
export function groqModelName(): string {
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

export async function generateGroqContent(
  prompt: string,
  systemPrompt?: string,
  isJson: boolean = false,
  maxOutputTokens?: number,
  timeoutMs?: number
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const model = groqModelName();

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  // This account's Groq free tier caps requests at 8,000 tokens/minute (prompt
  // + output), measured live. Clamping output keeps short calls inside it; a
  // full-length lesson does not fit, which is why lessons try both Gemini
  // models before ever reaching Groq.
  const GROQ_MAX_OUTPUT = 8000;
  const body: any = { model, messages };
  body.max_tokens = Math.min(maxOutputTokens ?? GROQ_MAX_OUTPUT, GROQ_MAX_OUTPUT);
  if (isJson) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: providerSignal(timeoutMs),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Groq API Error:", errorText);
    // Status carried on the error so callers can tell a rate limit (retry
    // later helps) apart from a real failure (retrying immediately won't).
    throw Object.assign(new Error(`Groq API failed: ${res.statusText}`), { status: res.status });
  }

  const data = await res.json();
  if (data.choices?.[0]?.finish_reason !== "stop") throw new Error("Fallback response incomplete.");
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq API returned empty response.");
  }

  return text;
}
