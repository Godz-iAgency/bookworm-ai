import { generateGroqContent } from "./groq";

/** An inline image attached to a Gemini call, base64-encoded with no data-URL prefix. */
export interface GeminiImage {
  mimeType: string;
  data: string;
}

/** Direct call to Gemini 2.5 Flash. Throws on any failure. */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  isJson: boolean = false,
  maxOutputTokens?: number,
  thinkingBudget?: number,
  image?: GeminiImage
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Image first, then the instruction, matching Gemini's own recommended
  // ordering for a single-image prompt.
  const parts: any[] = [];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  parts.push({ text: prompt });

  const payload: any = {
    contents: [
      {
        role: "user",
        parts
      }
    ]
  };

  if (systemPrompt) {
    payload.system_instruction = {
      parts: [{ text: systemPrompt }]
    };
  }

  if (isJson || maxOutputTokens || thinkingBudget !== undefined) {
    payload.generationConfig = {
      ...(isJson ? { responseMimeType: "application/json" } : {}),
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
    };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Gemini API Error:", errorText);
    // Status carried on the error so callers can tell a rate limit (retry
    // later helps) apart from a real failure (retrying immediately won't).
    throw Object.assign(new Error(`Gemini API failed: ${res.statusText}`), { status: res.status });
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini API returned empty response.");
  }

  /**
   * A run that stopped early still returns usable-looking text, and in JSON
   * mode it can even still parse: the model closes the object it is inside and
   * the result is valid JSON that is simply missing most of what was asked for.
   * That produced a course with one day in it and no flashcards, which reached
   * the reader looking like a finished course rather than a failed generation.
   * Treating it as a failure lets generateJson retry instead.
   */
  const finishReason = candidate?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    const usage = data.usageMetadata ?? {};
    console.error(
      `Gemini stopped early: ${finishReason}`,
      `(prompt ${usage.promptTokenCount ?? "?"}, output ${usage.candidatesTokenCount ?? "?"},`,
      `limit ${maxOutputTokens ?? "default"})`
    );
    throw new Error(`Gemini stopped early (${finishReason}).`);
  }

  return text;
}

/**
 * Generate content with Gemini 2.5 Flash, automatically falling back to the
 * free Groq (Llama 3.3 70B) model if Gemini fails for any reason (error, rate
 * limit, empty response). All callers get the fallback transparently.
 *
 * The fallback is text-only. A request carrying an image has nothing Groq can
 * do with it, so it skips straight to the original Gemini error rather than
 * sending Groq a prompt that silently drops the photo and answers about
 * nothing.
 */
export async function generateGeminiContent(
  prompt: string,
  systemPrompt?: string,
  isJson: boolean = false,
  maxOutputTokens?: number,
  thinkingBudget?: number,
  image?: GeminiImage
): Promise<string> {
  try {
    return await callGemini(prompt, systemPrompt, isJson, maxOutputTokens, thinkingBudget, image);
  } catch (err) {
    const hasGroq = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
    if (!hasGroq || image) throw err;
    console.warn("Gemini failed — falling back to Groq.", err);
    return await generateGroqContent(prompt, systemPrompt, isJson, maxOutputTokens);
  }
}
