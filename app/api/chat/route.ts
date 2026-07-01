import { NextResponse } from "next/server";
import { generateGeminiContent } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { title, author, message } = await req.json();

    const prompt = message;
    
    const systemPrompt = `You are an expert on the book '${title}' by '${author}'. Answer all questions based on the book's principles, lessons, and concepts. Be engaging, clear, and educational. Limit every response to a maximum of 25 words. Responses should be concise, direct, and on-topic.`;

    const response = await generateGeminiContent(prompt, systemPrompt, false);

    return NextResponse.json({ reply: response });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
