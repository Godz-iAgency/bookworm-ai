import { NextResponse } from "next/server";
import { buildFlashcardsMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

// Much smaller than a full lesson generation — 3 cards + 3 starters only.
export const maxDuration = 60;

/**
 * Rebuilds just the flashcards + chat starters for a day that already has a
 * lesson. Used when the original generation returned a lesson but an empty
 * deck; deliberately narrower than /api/course/day so a lesson the reader has
 * already read is never regenerated underneath them.
 */
export async function POST(req: Request) {
  try {
    const { title, author, readingLevel, dayNumber, dayTitle, lesson } = await req.json();
    if (!title || !dayNumber || !lesson) {
      return NextResponse.json({ error: "Missing day details." }, { status: 400 });
    }

    const { system, user } = buildFlashcardsMessages(
      title,
      author,
      readingLevel,
      dayNumber,
      dayTitle ?? `Day ${dayNumber}`,
      lesson
    );

    const parsed = await generateJson(user, system, 2048);

    const flashcards = Array.isArray(parsed?.flashcards)
      ? parsed.flashcards
          .filter((c: any) => c && typeof c.front === "string" && typeof c.back === "string")
          .slice(0, 3)
          .map((c: any) => ({ front: stripEmDashes(c.front), back: stripEmDashes(c.back) }))
      : [];

    if (flashcards.length === 0) {
      throw new Error("Flashcard generation returned no usable cards.");
    }

    return NextResponse.json({
      flashcards,
      chatSeed: Array.isArray(parsed?.chatSeed)
        ? parsed.chatSeed.filter((s: any) => typeof s === "string").slice(0, 3)
        : [],
    });
  } catch (error: any) {
    console.error("Flashcard repair failed:", error);
    return NextResponse.json(
      { error: error.message || "Flashcard generation failed." },
      { status: 500 }
    );
  }
}
