import { guardAI } from "@/lib/ai-guard";
import { NextResponse } from "next/server";
import { AI_TASKS } from "@/lib/ai-models";
import { generateContent } from "@/lib/gemini";
import { stripEmDashes } from "@/lib/lesson";
import { STYLE_RULES, getLanguageRules } from "@/lib/course-prompts";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const denied = await guardAI(req, "chat");
    if (denied) return denied;
    const { title, author, message, lesson, dayTitle, dayNumber, language } = await req.json();

    const prompt = message;

    // Ground BookPal in the exact lesson the reader just studied, when we have
    // it. Falls back to general book knowledge if no lesson was passed.
    const lessonContext = lesson
      ? `\n\nThe reader is on Day ${dayNumber ?? "?"}${dayTitle ? ` ("${dayTitle}")` : ""}. Here is the exact lesson they just studied — ground your answer in THIS lesson first, then the wider book only if needed:\n"""\n${lesson}\n"""`
      : "";

    // The reader's language comes from the course they are reading, not their
    // current profile setting, so chat about a Spanish course stays Spanish
    // even after they switch the setting for future books.
    const systemPrompt = `You are BookPal, a warm and sharp reading tutor for the book '${title}' by '${author}'. Answer using the book's principles, lessons, and concepts. Be engaging, clear, and educational.${lessonContext}\n\nLimit every response to a maximum of 25 words. Be concise, direct, and on-topic.\n\n${getLanguageRules(language, { json: false })}\n\n${STYLE_RULES}`;

    const { text } = await generateContent(AI_TASKS.chat, prompt, systemPrompt);

    const revoked = await guardAI(req, "chat", false);
    if (revoked) return revoked;
    return NextResponse.json({ reply: stripEmDashes(text) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
