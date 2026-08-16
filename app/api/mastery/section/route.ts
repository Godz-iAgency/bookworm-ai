import { NextResponse } from "next/server";
import { buildSummarySectionMessages } from "@/lib/mastery-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

export const maxDuration = 60;

/**
 * Step 2 of a Personal Development summary: one section's prose. The client
 * fires these in small parallel batches, which is what keeps a 6,000 word
 * summary to a reasonable wait instead of a sequential crawl.
 */
export async function POST(req: Request) {
  try {
    const { title, author, thesis, allTitles, index, sectionTitle, focus, keyIdeas } =
      await req.json();

    if (!title || typeof index !== "number" || !sectionTitle) {
      return NextResponse.json({ error: "Missing section details." }, { status: 400 });
    }

    const { system, user } = buildSummarySectionMessages(
      title,
      author,
      typeof thesis === "string" ? thesis : "",
      Array.isArray(allTitles) ? allTitles : [],
      index,
      sectionTitle,
      typeof focus === "string" ? focus : "",
      Array.isArray(keyIdeas) ? keyIdeas : []
    );

    const parsed = await generateJson(user, system, 8192);

    if (!parsed?.prose) {
      throw new Error("Section generation returned no prose.");
    }

    return NextResponse.json({ prose: stripEmDashes(parsed.prose) });
  } catch (error: any) {
    console.error("Summary section generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not write this section." },
      { status: 500 }
    );
  }
}
