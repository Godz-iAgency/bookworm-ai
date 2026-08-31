import { NextResponse } from "next/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { planFromId } from "@/lib/plans";

const BOOK_CLUB_MAX_MEMBERS = planFromId("book_club").maxMembers ?? 4;

/** Redeems a Book Club invite code, adding the joining user to the family. */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Missing code." }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const inviteRef = db.collection("invites").doc(code);

    /**
     * Every check and every write in one transaction.
     *
     * Checking the seat count and then writing in a separate batch is only
     * correct while nobody else is joining at the same moment. Two people
     * redeeming their invites within the same instant both read "3 of 4 seats
     * taken", both decide there is room, and both commit - a 5-person Book
     * Club on a 4-seat subscription, with the owner paying for four. The same
     * gap lets one code be redeemed twice. A transaction re-runs if anything
     * it read changed underneath it, so the second writer sees the first one's
     * result and is turned away properly.
     *
     * Failures throw a tagged Error rather than returning, so the status code
     * survives being thrown out of the transaction callback.
     */
    const fail = (status: number, message: string) =>
      Object.assign(new Error(message), { httpStatus: status });

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw fail(404, "User not found.");
      if (userSnap.data()!.familyId) throw fail(400, "You're already in a Book Club.");

      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw fail(404, "Invite not found.");
      const invite = inviteSnap.data()!;
      if (invite.usedByUid) throw fail(400, "Invite already used.");

      const familyRef = db.collection("families").doc(invite.familyId);
      const familySnap = await tx.get(familyRef);
      if (!familySnap.exists || familySnap.data()!.status !== "active") {
        throw fail(400, "This Book Club is no longer active.");
      }
      const memberIds: string[] = familySnap.data()!.memberIds ?? [];
      if (memberIds.length >= BOOK_CLUB_MAX_MEMBERS) {
        throw fail(400, "This Book Club is full.");
      }

      tx.update(familyRef, { memberIds: FieldValue.arrayUnion(uid) });
      tx.update(userRef, { familyId: invite.familyId, isFamilyOwner: false });
      tx.update(inviteRef, { usedByUid: uid, usedAt: new Date().toISOString() });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // A tagged failure from inside the transaction is a real answer for the
    // reader ("already used", "club is full"), not a server fault - it keeps
    // its own status instead of being flattened into a 500.
    const status = typeof error?.httpStatus === "number" ? error.httpStatus : 500;
    if (status === 500) console.error("family join failed:", error);
    return NextResponse.json({ error: error.message || "Could not join Book Club." }, { status });
  }
}
