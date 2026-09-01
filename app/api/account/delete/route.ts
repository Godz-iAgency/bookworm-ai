import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getAdminAuth, getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const maxDuration = 60;

/**
 * Delete the account and everything attached to it, permanently.
 *
 * Google Play requires that anyone who can create an account in the app can
 * also delete it, and requires the deletion to actually remove their data
 * rather than just hide it. So this is not a "mark as inactive": it stops the
 * billing, detaches the account from any Book Club in both directions, removes
 * the reader's courses, removes the profile, and finally removes the sign-in
 * itself.
 *
 * Order matters. Stripe is cancelled first because that is the step that costs
 * money if it silently fails, and the auth record is removed last because it is
 * the only one that cannot be re-derived if something in the middle throws -
 * a half-deleted account that can still sign in is recoverable, one that cannot
 * sign in but is still being billed is not.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const user = snap.exists ? snap.data()! : null;

    // ---- 1. Stop any billing -------------------------------------------
    if (user?.stripeSubscriptionId) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (e: any) {
        // Already cancelled or gone is fine; anything else must not leave the
        // reader unable to delete their account, but it does need saying.
        console.error("Could not cancel subscription during account delete:", e?.message);
      }
    }

    // ---- 2. Detach from any Book Club ------------------------------------
    if (user?.familyId) {
      const familyRef = db.collection("families").doc(user.familyId);
      const famSnap = await familyRef.get();

      if (famSnap.exists) {
        if (user.isFamilyOwner) {
          // The club existed on this person's subscription, so it goes with
          // them. Every member loses access, exactly as when an owner
          // downgrades - access is granted on familyId alone, so clearing it
          // is what actually revokes anything.
          const memberIds: string[] = famSnap.data()!.memberIds ?? [];
          await familyRef.update({ status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
          const batch = db.batch();
          for (const memberId of memberIds) {
            if (memberId === uid) continue;
            batch.update(db.collection("users").doc(memberId), {
              familyId: null,
              isFamilyOwner: false,
            });
          }
          await batch.commit();
        } else {
          // A member leaving frees their seat for someone else.
          await familyRef.update({ memberIds: FieldValue.arrayRemove(uid) });
        }
      }
    }

    // ---- 3. Remove their content -----------------------------------------
    // Subcollections are not removed with their parent, so each is cleared
    // explicitly. `summaries` is from the retired long-form feature and may
    // still hold documents on older accounts.
    for (const sub of ["courses", "summaries"]) {
      const docs = await userRef.collection(sub).get();
      while (docs.docs.length) {
        const batch = db.batch();
        for (const d of docs.docs.splice(0, 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }

    // Any invite this person minted is dead once their club is gone.
    if (user?.familyId && user?.isFamilyOwner) {
      const invites = await db.collection("invites").where("familyId", "==", user.familyId).get();
      const batch = db.batch();
      for (const d of invites.docs) batch.delete(d.ref);
      if (invites.docs.length) await batch.commit();
    }

    // ---- 4. Remove the profile, then the sign-in -------------------------
    await userRef.delete().catch(() => {});
    await getAdminAuth().deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("account delete failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not delete your account." },
      { status: 500 }
    );
  }
}
