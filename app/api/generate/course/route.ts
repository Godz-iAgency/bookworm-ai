import { NextResponse } from "next/server";
import { generateGeminiContent } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { title, author, readingLevel } = await req.json();

    const prompt = `You are an expert course designer. Generate a 7-day learning course for the book '${title}' by '${author}' for a ${readingLevel} reader. For each day provide: a day title, 3-4 key concepts, a 150-word lesson summary, and 2 reflection questions. Return as JSON.`;

    const systemPrompt = `You must return a valid JSON object with a strictly typed array under the key "days" matching exactly this structure:
{
  "days": [
    {
      "dayNumber": number (1 through 7),
      "title": "string",
      "previewText": "string (the 150-word lesson summary)",
      "isUnlocked": boolean (set day 1 to true, others false),
      "isCompleted": false,
      "concepts": ["string"],
      "reflection": ["string"]
    }
  ]
}
DO NOT wrap the response in markdown \`\`\`json blocks.`;

    const rawResponse = await generateGeminiContent(prompt, systemPrompt, true);
    // Sanitize in case Gemini still wraps it in JSON backticks
    const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
