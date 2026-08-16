import { NextResponse } from "next/server";
import { buildSummaryOutlineMessages } from "@/lib/mastery-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

export const maxDuration = 60;

/**
 * Step 1 of a Personal Development summary: the structural map of the book.
 * Cheap and fast on its own, and every section call depends on it, so it is
 * kept separate rather than folded into one giant generation.
 */
export async function POST(req: Request) {
  try {
    const { title, author } = await req.json();
    if (!title) {
      return NextResponse.json({ error: "Missing book title." }, { status: 400 });
    }

    const { system, user } = buildSummaryOutlineMessages(title, author);
    const parsed = await generateJson(user, system, 4096);

    const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
    if (sections.length === 0) {
      throw new Error("Outline generation returned no sections.");
    }

    return NextResponse.json({
      confident: parsed.confident !== false,
      thesis: typeof parsed.thesis === "string" ? stripEmDashes(parsed.thesis) : "",
      frameworks: Array.isArray(parsed.frameworks)
        ? parsed.frameworks.filter((f: any) => typeof f === "string").map(stripEmDashes)
        : [],
      sections: sections.slice(0, 9).map((s: any) => ({
        title: typeof s?.title === "string" ? stripEmDashes(s.title) : "Untitled",
        focus: typeof s?.focus === "string" ? stripEmDashes(s.focus) : "",
        keyIdeas: Array.isArray(s?.keyIdeas)
          ? s.keyIdeas.filter((k: any) => typeof k === "string").map(stripEmDashes)
          : [],
      })),
    });
  } catch (error: any) {
    console.error("Summary outline generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not plan this summary." },
      { status: 500 }
    );
  }
}
