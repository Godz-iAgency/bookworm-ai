import { NextResponse } from "next/server";
import { buildDayMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { title, author, readingLevel, dayNumber, dayTitle, allTitles, thesis, frameworks, keyIdeas } =
      await req.json();
    if (!title || !dayNumber || !dayTitle) {
      return NextResponse.json({ error: "Missing day details." }, { status: 400 });
    }

    const { system, user } = buildDayMessages(
      title,
      author,
      readingLevel,
      dayNumber,
      dayTitle,
      Array.isArray(allTitles) ? allTitles : [],
      typeof thesis === "string" ? thesis : "",
      Array.isArray(frameworks) ? frameworks : [],
      Array.isArray(keyIdeas) ? keyIdeas : []
    );

    const parsed = await generateJson(user, system, 8192, 3, (p) =>
      typeof p?.lesson === "string" && p.lesson.trim() ? null : "Day generation returned no lesson."
    );

    // The prompt asks for no em dashes; this is what actually guarantees it.
    return NextResponse.json({
      lesson: stripEmDashes(parsed.lesson),
      flashcards: Array.isArray(parsed.flashcards)
        ? parsed.flashcards.slice(0, 3).map((c: any) => ({
            front: typeof c?.front === "string" ? stripEmDashes(c.front) : c?.front,
            back: typeof c?.back === "string" ? stripEmDashes(c.back) : c?.back,
          }))
        : [],
      chatSeed: Array.isArray(parsed.chatSeed)
        ? parsed.chatSeed.slice(0, 3).map((s: any) => (typeof s === "string" ? stripEmDashes(s) : s))
        : [],
    });
  } catch (error: any) {
    console.error("Day generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Day generation failed." },
      { status: 500 }
    );
  }
}
