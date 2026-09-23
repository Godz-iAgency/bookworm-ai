import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { generateDayContent } from "@/lib/day-generation";

// Same work as /api/course/day: a full lesson, possible expansion, study aids.
export const maxDuration = 300;

const MAX_ATTEMPTS = 2;
const TICKET_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Day 1 for the free preview, before the reader has a card on file.
 *
 * /api/course/day needs a saved course and an active plan, and a preview
 * reader has neither yet: Day 1 is what they read to decide. What they do have
 * is the generation ticket the outline call wrote, which already cost them one
 * of their preview attempts. That ticket authorizes Day 1 of that one plan,
 * written from the plan stored on it rather than from anything the client
 * sends, at most twice (a first try and one retry), and only until the course
 * is saved, after which the normal route takes over.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const { generationId } = await req.json();
    if (typeof generationId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(generationId)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const ticketRef = userRef.collection("generatedCourses").doc(generationId);
    let ticket: any;
    try {
      await db.runTransaction(async (tx) => {
        const profile = (await tx.get(userRef)).data();
        const t = (await tx.get(ticketRef)).data();
        if (!profile || profile.accessOverride?.active === false || profile.deletionPending) throw new Error("Access unavailable.");
        if (!t || t.consumed || !t.outline?.days?.length) throw new Error("Course not found.");
        if (!(Date.now() - Date.parse(t.createdAt) < TICKET_TTL_MS)) throw new Error("Course not found.");
        if (Number(t.firstDayAttempts ?? 0) >= MAX_ATTEMPTS) throw new Error("Day 1 will be written when you open your course.");
        tx.update(ticketRef, { firstDayAttempts: Number(t.firstDayAttempts ?? 0) + 1 });
        ticket = t;
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Access unavailable." }, { status: 403 });
    }

    const days: any[] = ticket.outline.days;
    const first = days[0];
    const content = await generateDayContent(
      {
        title: ticket.title,
        author: ticket.author ?? "",
        readingLevel: ticket.readingLevel ?? "",
        language: ticket.language ?? "en",
        thesis: ticket.outline.thesis ?? "",
        frameworks: ticket.outline.frameworks ?? [],
        arc: days.map((d) => ({ title: d.title, coreConcept: d.coreConcept || undefined })),
      },
      {
        dayNumber: 1,
        title: first.title,
        coreConcept: first.coreConcept || undefined,
        learningObjective: first.learningObjective || undefined,
        keyIdeas: first.keyIdeas ?? [],
        bookConnection: first.bookConnection || undefined,
      }
    );

    // Recheck before handing over a result that took minutes to write.
    const profile = (await userRef.get()).data();
    if (!profile || profile.accessOverride?.active === false || profile.deletionPending) {
      return NextResponse.json({ error: "Access unavailable." }, { status: 403 });
    }
    return NextResponse.json(content);
  } catch (error: any) {
    console.error("First day generation failed:", error);
    return NextResponse.json({ error: error.message || "Day generation failed." }, { status: 500 });
  }
}
