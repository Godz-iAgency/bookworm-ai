import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { clubError, requireClub, statusOf } from "@/lib/family-server";

/**
 * Resolve a share into what the client needs to start reading it live.
 *
 * Nothing is copied or created here — there is no per-reader document at all
 * for a shared book. This just validates (membership still intact, share
 * still active, the sharer's book not expired) and hands back the sharer's
 * uid + course id, which is what firestore.rules' isSharedWithReader checks
 * against when the client opens a direct, live listener on that course. That
 * listener is the actual "open" — this route only clears the reader for it.
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

    const familyRef = db.collection("families").doc(club.familyId);
    const [familySnap, memberSnap, shareSnap] = await Promise.all([
      familyRef.get(),
      db.collection("users").doc(uid).get(),
      familyRef.collection("sharedBooks").doc(shareId).get(),
    ]);
    const family = familySnap.data();
    const member = memberSnap.data();
    if (family?.status !== "active" || !family.memberIds?.includes(uid) || member?.familyId !== club.familyId) {
      throw clubError(403, "Membership changed.");
    }
    if (!shareSnap.exists) throw clubError(404, "That book is no longer shared with your Book Club.");
    const share = shareSnap.data()!;

    const courseSnap = await db.collection("users").doc(share.sharedByUid).collection("courses").doc(share.sourceCourseId).get();
    if (!courseSnap.exists) throw clubError(404, "That book is no longer available.");
    const course = courseSnap.data()!;
    if (new Date(course.expiresAt).getTime() <= Date.now()) {
      throw clubError(400, "That book has expired.");
    }

    return NextResponse.json({
      shareId,
      sharedByUid: share.sharedByUid,
      sharedByName: share.sharedByName,
      sourceCourseId: share.sourceCourseId,
    });
  } catch (error: any) {
    const status = statusOf(error);
    if (status === 500) console.error("open shared book failed:", error);
    return NextResponse.json({ error: error.message || "Could not open that book." }, { status });
  }
}
