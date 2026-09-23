import { guardAI } from "@/lib/ai-guard";
import { NextResponse } from "next/server";
import { buildAxiomMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

// One sentence. The flashcard repair route can also produce an axiom, but it
// regenerates a whole deck on the way and takes about a minute; this exists so
// a day that only needs its closing line gets it in seconds.
export const maxDuration = 30;

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

    const parsed = await generateJson(user, system, 256, 2, (p) =>
      typeof p?.closingAxiom === "string" && p.closingAxiom.trim()
        ? null
        : "Axiom generation returned nothing."
    );

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
