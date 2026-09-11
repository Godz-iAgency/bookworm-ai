import { FieldValue } from "firebase-admin/firestore";
import { getStripe } from "./stripe/server";
import { getAdminAuth, getAdminDb } from "./firebase/admin";
import { dissolveClub } from "./family-server";

/**
 * Delete an account and everything attached to it, permanently.
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
 *
 * Lives here rather than in the route because two callers need exactly this:
 * the reader asking for it (/api/account/delete) and the daily sweep clearing
 * out removed Book Club members who never chose a plan.
 */
export async function deleteAccount(uid: string): Promise<void> {
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
        // them — membership, shared shelf and every copy of it, exactly as
        // when an owner downgrades out of Book Club.
        await dissolveClub(db, user.familyId, uid);
      } else {
        // A member leaving frees their seat for someone else. Whatever they
        // put on the club's shelf goes with them, along with everyone else's
        // copy of it — a copy is the access. Books OTHER members shared need
        // no special handling here: this reader's copies of those are simply
        // their own courses, cleared by the sweep below.
        const memberIds: string[] = famSnap.data()!.memberIds ?? [];
        await familyRef.update({ memberIds: FieldValue.arrayRemove(uid) });

        const theirShares = await familyRef
          .collection("sharedBooks")
          .where("sharedByUid", "==", uid)
          .get();
        if (!theirShares.empty) {
          const batch = db.batch();
          for (const d of theirShares.docs) batch.delete(d.ref);
          for (const memberId of memberIds) {
            if (memberId === uid) continue;
            for (const d of theirShares.docs) {
              batch.delete(db.collection("users").doc(memberId).collection("courses").doc(d.id));
            }
          }
          await batch.commit();
        }
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

  // ---- 4. Remove the profile, then the sign-in -------------------------
  await userRef.delete().catch(() => {});
  await getAdminAuth().deleteUser(uid);
}
