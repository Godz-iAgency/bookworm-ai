/**
 * Groq fallback model (free tier). Used automatically when the primary Gemini
 * call fails. Groq's API is OpenAI-compatible. Default model is Llama 3.3 70B,
 * overridable via GROQ_MODEL.
 */
export async function generateGroqContent(
  prompt: string,
  systemPrompt?: string,
  isJson: boolean = false,
  maxOutputTokens?: number
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  // Groq's free tier caps requests at 12,000 tokens/minute (prompt + output).
  // Clamp output so the fallback stays within the free limit. Our outline and
  // per-day generations only need ~2,000 output tokens.
  const GROQ_MAX_OUTPUT = 8000;
  const body: any = { model, messages };
  body.max_tokens = Math.min(maxOutputTokens ?? GROQ_MAX_OUTPUT, GROQ_MAX_OUTPUT);
  if (isJson) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
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
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq API returned empty response.");
  }

  return text;
}
