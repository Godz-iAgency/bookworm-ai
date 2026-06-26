import { NextResponse } from "next/server";
import { buildOutlineMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";

// Outline + Day 1 is a smaller call, but allow headroom.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { title, author, readingLevel } = await req.json();
    if (!title) {
      return NextResponse.json({ error: "Missing book title." }, { status: 400 });
    }

    const { system, user } = buildOutlineMessages(title, author, readingLevel);

    const parsed = await generateJson(user, system, 16384);

    if (!parsed?.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      throw new Error("Generation returned no days.");
    }

    return NextResponse.json({ days: parsed.days, familiar: parsed.familiar !== false });
  } catch (error: any) {
    console.error("Course generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Course generation failed." },
      { status: 500 }
    );
  }
}
