import { guardAI } from "@/lib/ai-guard";
import { NextResponse } from "next/server";
import { AI_TASKS } from "@/lib/ai-models";
import { buildAxiomMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";
import { scriptGlitches, stripEmDashes } from "@/lib/lesson";

// One sentence. The flashcard repair route can also produce an axiom, but it
// regenerates a whole deck on the way and takes about a minute; this exists so
// a day that only needs its closing line gets it in seconds.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const denied = await guardAI(req, "study");
    if (denied) return denied;
    const { title, author, readingLevel, language, dayTitle, lesson } = await req.json();
    if (!title || !lesson) {
      return NextResponse.json({ error: "Missing lesson." }, { status: 400 });
    }

    const { system, user } = buildAxiomMessages(
      title,
      author,
      readingLevel,
      language,
      dayTitle ?? "",
      lesson
    );

    const { data: parsed } = await generateJson(AI_TASKS.axiom, user, system, {
      maxOutputTokens: 1024,
      budgetMs: 55_000,
      attempts: 2,
      validate: (p) =>
        typeof p?.closingAxiom !== "string" || !p.closingAxiom.trim()
          ? "Axiom generation returned nothing."
          : scriptGlitches(p.closingAxiom).length
            ? "Axiom has a word in the wrong alphabet."
            : null,
    });

    const revoked = await guardAI(req, "study", false);
    if (revoked) return revoked;
    return NextResponse.json({ closingAxiom: stripEmDashes(parsed.closingAxiom).trim() });
  } catch (error: any) {
    console.error("Axiom generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Axiom generation failed." },
      { status: 500 }
    );
  }
}
