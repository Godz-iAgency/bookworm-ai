import { NextResponse } from "next/server";
import { generateGeminiContent } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { title, author } = await req.json();

    const prompt = `Generate 15 flashcards for '${title}' by '${author}'. Each card has a question and answer based on the core principles of the book. Return as JSON array with 'question' and 'answer' fields.`;
    
    const systemPrompt = `Return a pure JSON array of objects. Keys must be exactly "front" (for the question) and "back" (for the answer). Do NOT wrap in markdown backticks.`;

    const rawResponse = await generateGeminiContent(prompt, systemPrompt, true);
    const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    return NextResponse.json({ cards: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
