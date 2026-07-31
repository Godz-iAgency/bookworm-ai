import { NextResponse } from "next/server";
import { generateGeminiContent } from "@/lib/gemini";
import { stripEmDashes } from "@/lib/lesson";
import { STYLE_RULES } from "@/lib/course-prompts";

export async function POST(req: Request) {
  try {
    const { title, author, message, lesson, dayTitle, dayNumber } = await req.json();

    const prompt = message;

    // Ground BookPal in the exact lesson the reader just studied, when we have
    // it. Falls back to general book knowledge if no lesson was passed.
    const lessonContext = lesson
      ? `\n\nThe reader is on Day ${dayNumber ?? "?"}${dayTitle ? ` ("${dayTitle}")` : ""}. Here is the exact lesson they just studied — ground your answer in THIS lesson first, then the wider book only if needed:\n"""\n${lesson}\n"""`
      : "";

    const systemPrompt = `You are BookPal, a warm and sharp reading tutor for the book '${title}' by '${author}'. Answer using the book's principles, lessons, and concepts. Be engaging, clear, and educational.${lessonContext}\n\nLimit every response to a maximum of 25 words. Be concise, direct, and on-topic.\n\n${STYLE_RULES}`;

    const response = await generateGeminiContent(prompt, systemPrompt, false);

    return NextResponse.json({ reply: stripEmDashes(response) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
