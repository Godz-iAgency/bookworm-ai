import { validStudyAids } from "@/lib/course-validation";
import { guardAI } from "@/lib/ai-guard";
import { NextResponse } from "next/server";
import { AI_TASKS } from "@/lib/ai-models";
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
    const denied = await guardAI(req, "study");
    if (denied) return denied;
    const { title, author, readingLevel, language, dayNumber, dayTitle, lesson } = await req.json();
    if (!title || !dayNumber || !lesson) {
      return NextResponse.json({ error: "Missing day details." }, { status: 400 });
    }

    const { system, user } = buildFlashcardsMessages(
      title,
      author,
      readingLevel,
      language,
      dayNumber,
      dayTitle ?? `Day ${dayNumber}`,
      lesson
    );

    const { data: parsed } = await generateJson(AI_TASKS.studyAids, user, system, {
      maxOutputTokens: 8192,
      budgetMs: 50_000,
      attempts: 3,
      validate: (value) => (validStudyAids(value) ? null : "Flashcard repair returned incomplete content."),
    });

    const flashcards = Array.isArray(parsed?.flashcards)
      ? parsed.flashcards
          .filter((c: any) => c && typeof c.front === "string" && typeof c.back === "string")
          .slice(0, 3)
          .map((c: any) => ({ front: stripEmDashes(c.front), back: stripEmDashes(c.back) }))
      : [];

    if (flashcards.length === 0) {
      throw new Error("Flashcard generation returned no usable cards.");
    }

    const revoked = await guardAI(req, "study", false);
    if (revoked) return revoked;
    return NextResponse.json({
      flashcards,
      chatSeed: Array.isArray(parsed?.chatSeed)
        ? parsed.chatSeed.filter((s: any) => typeof s === "string").slice(0, 3)
        : [],
      closingAxiom:
        typeof parsed?.closingAxiom === "string" ? stripEmDashes(parsed.closingAxiom).trim() : "",
    });
  } catch (error: any) {
    console.error("Flashcard repair failed:", error);
    return NextResponse.json(
      { error: error.message || "Flashcard generation failed." },
      { status: 500 }
    );
  }
}
