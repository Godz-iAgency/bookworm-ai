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
 * Nothing is copied. This creates a pointer only — firestore.rules'
 * isSharedWithReader is what actually lets the rest of the club read the
 * sharer's course document directly, live, for as long as the pointer exists.
 * Sharing costs no generation, and never regenerates anything: whatever the
 * sharer has (or hasn't) generated yet is exactly what the club sees, and it
 * updates the moment the sharer generates more.
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
    if (new Date(course.expiresAt).getTime() <= Date.now()) {
      throw clubError(400, "That book has expired.");
    }

    const shareId = shareIdFor(uid, courseId);
    await db.runTransaction(async tx => {
      const familyRef = db.collection("families").doc(club.familyId);
      const family = (await tx.get(familyRef)).data();
      const currentUser = (await tx.get(db.collection("users").doc(uid))).data();
      if (family?.status !== "active" || !family.memberIds?.includes(uid) || currentUser?.familyId !== club.familyId) throw clubError(403, "Membership changed.");
      const shareRef = db
      .collection("families")
      .doc(club.familyId)
      .collection("sharedBooks")
      .doc(shareId);
      if ((await tx.get(shareRef)).exists) return;
      tx.create(shareRef, {
        sharedByUid: uid,
        sharedByName: memberName(userSnap.data()),
        sourceCourseId: courseId,
        sharedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true, shareId });
  } catch (error: any) {
    const status = statusOf(error);
    if (status === 500) console.error("family share failed:", error);
    return NextResponse.json({ error: error.message || "Could not share that book." }, { status });
  }
}
