import { generateGroqContent } from "./groq";

/** Direct call to Gemini 2.5 Flash. Throws on any failure. */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  isJson: boolean = false,
  maxOutputTokens?: number,
  thinkingBudget?: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const payload: any = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
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
    throw new Error(`Gemini API failed: ${res.statusText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini API returned empty response.");
  }

  return text;
}

/**
 * Generate content with Gemini 2.5 Flash, automatically falling back to the
 * free Groq (Llama 3.3 70B) model if Gemini fails for any reason (error, rate
 * limit, empty response). All callers get the fallback transparently.
 */
export async function generateGeminiContent(
  prompt: string,
  systemPrompt?: string,
  isJson: boolean = false,
  maxOutputTokens?: number,
  thinkingBudget?: number
): Promise<string> {
  try {
    return await callGemini(prompt, systemPrompt, isJson, maxOutputTokens, thinkingBudget);
  } catch (err) {
    const hasGroq = process.env.GROQ_API_KEY || process.env.XAI_API_KEY;
    if (!hasGroq) throw err;
    console.warn("Gemini failed — falling back to Groq.", err);
    return await generateGroqContent(prompt, systemPrompt, isJson, maxOutputTokens);
  }
}
