import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { clubError, requireClub, statusOf } from "@/lib/family-server";

/**
 * Start (or resume) a book someone shared with the club.
 *
 * Answers with a course the reader can open immediately — their own copy,
 * carrying their own progress. Nothing is generated: the lessons come from the
 * snapshot taken when the book was shared, so this costs the reader neither a
 * generation nor one of their three personal slots.
 *
 * Opening a book they have already started returns what they already have.
 * A reader who taps through twice, or whose device still had stale state, must
 * never land back on day 1 with their progress quietly replaced.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { shareId } = await req.json();
    if (!shareId || typeof shareId !== "string") {
      return NextResponse.json({ error: "Missing shareId." }, { status: 400 });
    }

    const db = getAdminDb();
    const club = await requireClub(db, uid);

    const shareSnap = await db
      .collection("families")
      .doc(club.familyId)
      .collection("sharedBooks")
      .doc(shareId)
      .get();
    if (!shareSnap.exists) throw clubError(404, "That book is no longer shared with your Book Club.");
    const share = shareSnap.data()!;
    if (new Date(share.expiresAt).getTime() <= Date.now()) {
      throw clubError(400, "That book has expired.");
    }

    const existing = await db.collection("users").doc(uid).collection("courses").doc(shareId).get();
    if (existing.exists) {
      return NextResponse.json({ course: existing.data(), resumed: true });
    }

    const course = {
      id: shareId,
      book: share.book,
      readingLevel: share.readingLevel ?? "",
      status: "active",
      days: share.days ?? [],
      expiresAt: share.expiresAt,
      thesis: share.thesis ?? "",
      frameworks: share.frameworks ?? [],
      sharedFrom: {
        shareId,
        familyId: club.familyId,
        sharedByUid: share.sharedByUid,
        sharedByName: share.sharedByName,
      },
    };

    return NextResponse.json({ course, resumed: false });
  } catch (error: any) {
    const status = statusOf(error);
    if (status === 500) console.error("open shared book failed:", error);
    return NextResponse.json({ error: error.message || "Could not open that book." }, { status });
  }
}
