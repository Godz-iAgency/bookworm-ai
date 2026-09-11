import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { clubError, memberName, requireClub, statusOf } from "@/lib/family-server";
import { shareIdFor } from "@/lib/book-club";

/**
 * Put one of the reader's own books on their Book Club's shelf.
 *
 * The course is read from the reader's own collection rather than taken from
 * the request body: the body is the one thing the caller controls, and a
 * shared book is content other people will read.
 *
 * What lands on the shelf is a snapshot of the generated course with the
 * sharer's progress stripped out — their day 5 is not anyone else's day 5.
 * Nothing is regenerated and no generation is spent, here or when a member
 * opens it; the lessons already exist.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { courseId } = await req.json();
    if (!courseId || typeof courseId !== "string") {
      return NextResponse.json({ error: "Missing courseId." }, { status: 400 });
    }

    const db = getAdminDb();
    const club = await requireClub(db, uid);

    const [courseSnap, userSnap] = await Promise.all([
      db.collection("users").doc(uid).collection("courses").doc(courseId).get(),
      db.collection("users").doc(uid).get(),
    ]);
    if (!courseSnap.exists) throw clubError(404, "That book isn't on your shelf.");
    const course = courseSnap.data()!;

    // A copy of someone else's share is not the sharer's to pass on. Without
    // this, a book could be re-shared under a second reader's name and the
    // original could no longer be fully withdrawn by the person who shared it.
    if (course.sharedFrom) {
      throw clubError(400, "That book was shared with you — only the reader who shared it can manage it.");
    }
    if (new Date(course.expiresAt).getTime() <= Date.now()) {
      throw clubError(400, "That book has expired.");
    }

    const shareId = shareIdFor(uid, courseId);
    await db
      .collection("families")
      .doc(club.familyId)
      .collection("sharedBooks")
      .doc(shareId)
      .set({
        sharedByUid: uid,
        sharedByName: memberName(userSnap.data()),
        sourceCourseId: courseId,
        book: course.book,
        readingLevel: course.readingLevel ?? "",
        thesis: course.thesis ?? "",
        frameworks: course.frameworks ?? [],
        // Progress reset, content kept. Days the sharer never opened have no
        // lesson yet — those generate for each reader when they reach them,
        // exactly as they would on a book of their own, and cost no
        // generation either way (only whole courses count against the quota).
        days: (course.days ?? []).map((day: any, i: number) => ({
          dayNumber: day.dayNumber ?? i + 1,
          title: day.title ?? `Day ${i + 1}`,
          previewText: day.previewText ?? "",
          keyIdeas: day.keyIdeas ?? [],
          lesson: day.lesson ?? "",
          flashcards: day.flashcards ?? [],
          chatSeed: day.chatSeed ?? [],
          closingAxiom: day.closingAxiom ?? "",
          isUnlocked: i === 0,
          isCompleted: false,
        })),
        // The book's own clock keeps running. Book Club does not extend the
        // 7-day life of a course, so a book shared late is shared with
        // whatever time is left on it — which is shown on the card.
        expiresAt: course.expiresAt,
        sharedAt: new Date().toISOString(),
      });

    return NextResponse.json({ success: true, shareId });
  } catch (error: any) {
    const status = statusOf(error);
    if (status === 500) console.error("family share failed:", error);
    return NextResponse.json({ error: error.message || "Could not share that book." }, { status });
  }
}
