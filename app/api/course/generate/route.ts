import { randomUUID } from "node:crypto";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { validOutline } from "@/lib/course-validation";
import { guardAI, aiAdmissions } from "@/lib/ai-guard";
import { NextResponse } from "next/server";
import { AI_TASKS } from "@/lib/ai-models";
import { buildOutlineMessages } from "@/lib/course-prompts";
import { generateJson } from "@/lib/generate";
import { stripEmDashes } from "@/lib/lesson";

// The 7-day plan only. Lessons, including Day 1's, are written when opened.
export const maxDuration = 120;

const clean = (v: unknown) => (typeof v === "string" ? stripEmDashes(v).trim() : "");

export async function POST(req: Request) {
  try {
    const denied = await guardAI(req, "course");
    if (denied) return denied;
    const { title, author, readingLevel, language } = await req.json();
    if (!title) {
      return NextResponse.json({ error: "Missing book title." }, { status: 400 });
    }

    const { system, user } = buildOutlineMessages(title, author, readingLevel, language);

    // A course is seven planned days or it is not a course. Checked inside the
    // retry so a thin plan is regenerated rather than saved to someone's shelf.
    const outline = await generateJson(AI_TASKS.outline, user, system, {
      maxOutputTokens: 16384,
      budgetMs: 105_000,
      attempts: 3,
      validate: (p) => {
        const days = Array.isArray(p?.days) ? p.days : [];
        if (days.length < 7) return `Outline returned ${days.length} of 7 days.`;
        return validOutline(p) ? null : "Outline response is incomplete.";
      },
    });
    const parsed = outline.data;

    const days = parsed.days.slice(0, 7).map((d: any, i: number) => ({
      dayNumber: i + 1,
      title: clean(d.title),
      previewText: clean(d.previewText),
      coreConcept: clean(d.coreConcept),
      learningObjective: clean(d.learningObjective),
      keyIdeas: (d.keyIdeas as unknown[]).filter((k) => typeof k === "string" && k.trim()).slice(0, 6).map(clean),
      bookConnection: clean(d.bookConnection),
    }));
    // Carried through to the client and stored on the course, so every day is
    // written against the same reading of the book the plan settled on.
    const thesis = clean(parsed.thesis);
    const frameworks = Array.isArray(parsed.frameworks)
      ? parsed.frameworks.filter((f: unknown) => typeof f === "string").map(clean)
      : [];

    const uid = await getUidFromRequest(req);
    if (!uid) return NextResponse.json({ error: "Access revoked." }, { status: 403 });
    const generationId = randomUUID();
    const db = getAdminDb();
    await db.runTransaction(async tx => {
      const ref = db.collection("users").doc(uid);
      const profile = (await tx.get(ref)).data();
      if (!profile || profile.accessOverride?.active === false || profile.deletionPending) throw new Error("Access revoked.");
      // The plan rides on the ticket so the free-preview Day 1 is written from
      // what the server generated, not from whatever a client sends back.
      tx.create(ref.collection("generatedCourses").doc(generationId), { title, author: author ?? "", readingLevel: readingLevel ?? "", language: language ?? "en", createdAt: new Date().toISOString(), consumed: false, charged: aiAdmissions.get(req) === true, outline: { thesis, frameworks, days } });
    });
    return NextResponse.json({
      generationId,
      days,
      familiar: parsed.familiar !== false,
      thesis,
      frameworks,
      generatedBy: `${outline.provider}:${outline.model}`,
    });
  } catch (error: any) {
    console.error("Course generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Course generation failed." },
      { status: 500 }
    );
  }
}
