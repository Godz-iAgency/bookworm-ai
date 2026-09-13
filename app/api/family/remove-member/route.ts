import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { clubError, deleteSharedCopies, requireClub, statusOf } from "@/lib/family-server";
import { CONVERSION_WINDOW_DAYS } from "@/lib/book-club";

/**
 * The Book Club owner removes a member.
 *
 * Three things have to happen together, and the order is what makes the
 * result honest rather than merely tidy:
 *
 *  1. Access ends now. Membership is what grants the tier (see
 *     getEffectivePlanId), so clearing familyId is the revocation — and every
 *     copy of a shared book, in both directions, goes with it. Books they
 *     shared leave the club's shelf; books others shared leave their device.
 *     Their OWN books are not touched. They generated those.
 *
 *  2. Their account is not deleted. They keep their reading, their streak and
 *     their preferences while they decide what to do next.
 *
 *  3. A 7-day clock starts — but only for someone who is actually left with
 *     nothing. A member who happens to carry their own trial or subscription
 *     simply falls back to it, and starting a deletion countdown on a paying
 *     reader would be indefensible.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { memberUid } = await req.json();
    if (!memberUid || typeof memberUid !== "string") {
      return NextResponse.json({ error: "Missing memberUid." }, { status: 400 });
    }

    const db = getAdminDb();
    const club = await requireClub(db, uid);
    if (!club.isOwner) throw clubError(403, "Only the Book Club owner can remove members.");
    if (memberUid === uid) {
      throw clubError(400, "You can't remove yourself — change your plan instead.");
    }
    if (!club.memberIds.includes(memberUid)) {
      throw clubError(404, "That reader isn't in your Book Club.");
    }

    await db.runTransaction(async tx => {
      const familyRef = db.collection("families").doc(club.familyId);
      const family = (await tx.get(familyRef)).data();
      if (family?.ownerId !== uid || family.status !== "active") throw clubError(403, "Membership changed.");
      const memberRef = db.collection("users").doc(memberUid);
      const member = (await tx.get(memberRef)).data();
      if (!family.memberIds.includes(memberUid) || member?.familyId !== club.familyId) return;
      const shares = await tx.get(familyRef.collection("sharedBooks"));
      const keepsOwnAccess = !!member.accessOverride || !!member.stripeSubscriptionId || member.trialStatus === "active" || (!!member.plan && member.plan !== "free");
      for (const share of shares.docs) {
        tx.delete(memberRef.collection("courses").doc(share.id));
        if (share.data().sharedByUid === memberUid) {
          tx.delete(share.ref);
          for (const id of family.memberIds) tx.delete(db.collection("users").doc(id).collection("courses").doc(share.id));
        }
      }
      tx.update(familyRef, { memberIds: FieldValue.arrayRemove(memberUid) });
      tx.update(memberRef, { familyId: null, isFamilyOwner: false,
        bookClubRemovedAt: new Date().toISOString(),
        bookClubDeleteAt: keepsOwnAccess ? null : new Date(Date.now() + CONVERSION_WINDOW_DAYS * 86400000).toISOString() });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = statusOf(error);
    if (status === 500) console.error("remove member failed:", error);
    return NextResponse.json({ error: error.message || "Could not remove that member." }, { status });
  }
}
