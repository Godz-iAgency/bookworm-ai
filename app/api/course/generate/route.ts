import { NextResponse } from "next/server";
import { buildOutlineMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

// Outline + Day 1 is a smaller call, but allow headroom.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { title, author, readingLevel } = await req.json();
    if (!title) {
      return NextResponse.json({ error: "Missing book title." }, { status: 400 });
    }

    const { system, user } = buildOutlineMessages(title, author, readingLevel);

    // A course is seven days or it is not a course. Checked inside the retry so
    // a short outline is regenerated rather than saved to someone's shelf.
    const parsed = await generateJson(user, system, 16384, 3, (p) => {
      const days = Array.isArray(p?.days) ? p.days : [];
      if (days.length < 7) return `Outline returned ${days.length} of 7 days.`;
      if (typeof days[0]?.lesson !== "string" || !days[0].lesson.trim()) {
        return "Outline returned no Day 1 lesson.";
      }
      return null;
    });

    return NextResponse.json({
      days: parsed.days,
      familiar: parsed.familiar !== false,
      // Carried through to the client and stored on the course, so days 2-7 are
      // written against the same reading of the book the outline settled on.
      thesis: typeof parsed.thesis === "string" ? stripEmDashes(parsed.thesis) : "",
      frameworks: Array.isArray(parsed.frameworks)
        ? parsed.frameworks.filter((f: unknown) => typeof f === "string").map(stripEmDashes)
        : [],
    });
  } catch (error: any) {
    console.error("Course generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Course generation failed." },
      { status: 500 }
    );
  }
}
