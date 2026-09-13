import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { clubError, requireClub, statusOf } from "@/lib/family-server";

/**
 * Take a book back off the Book Club's shelf.
 *
 * Only the reader who shared it can withdraw it. Deleting this one pointer IS
 * the revocation: firestore.rules' isSharedWithReader requires an active share
 * record to exist, so the moment it's gone, every other member's live read of
 * that course fails on their very next request. The sharer's own book is
 * untouched — this withdraws the share, it does not delete anyone's course.
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

    const shareRef = db.collection("families").doc(club.familyId).collection("sharedBooks").doc(shareId);
    await db.runTransaction(async tx => {
    const family = (await tx.get(db.collection("families").doc(club.familyId))).data();
    if (family?.status !== "active" || !family.memberIds?.includes(uid)) throw clubError(403, "Membership changed.");
    const shareSnap = await tx.get(shareRef);
    if (!shareSnap.exists) {
      // Already gone is the state the caller wanted. Saying so as an error
      // would only ever strand a screen that is already correct.
      return;
    }
    if (shareSnap.data()!.sharedByUid !== uid) {
      throw clubError(403, "Only the reader who shared this book can remove it.");
    }

    tx.delete(shareRef);
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = statusOf(error);
    if (status === 500) console.error("family unshare failed:", error);
    return NextResponse.json({ error: error.message || "Could not remove that book." }, { status });
  }
}
