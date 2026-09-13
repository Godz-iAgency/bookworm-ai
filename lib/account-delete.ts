import { withAccountLock } from "./account-lock";
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
export async function deleteAccount(uid: string, onlyIfRemoved = false): Promise<boolean> {
  return withAccountLock(uid, () => deleteLocked(uid, onlyIfRemoved));
}

async function deleteLocked(uid: string, onlyIfRemoved: boolean): Promise<boolean> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const user = snap.exists ? snap.data()! : null;

  if (onlyIfRemoved && (!user?.bookClubDeleteAt || Date.parse(user.bookClubDeleteAt) > Date.now() || !Number.isFinite(Date.parse(user.bookClubDeleteAt)) || user.accessOverride || user.stripeSubscriptionId || user.familyId || user.trialStatus === "active" || (user.plan && user.plan !== "free"))) return false;

  // ---- 1. Stop any billing -------------------------------------------
  if (user?.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (e: any) {
      // A missing subscription is already stopped. Any other failure must
      // preserve the account so cancellation can be retried safely.
      if (e?.code !== "resource_missing") throw e;
    }
  }

  if (user) await userRef.update({ deletionPending: true });

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
        await db.runTransaction(async tx => {
          const family = (await tx.get(familyRef)).data();
          const shares = await tx.get(familyRef.collection("sharedBooks"));
          if (!family) return;
          tx.update(familyRef, { memberIds: FieldValue.arrayRemove(uid) });
          for (const share of shares.docs) if (share.data().sharedByUid === uid) {
            tx.delete(share.ref);
            for (const id of family.memberIds ?? []) tx.delete(db.collection("users").doc(id).collection("courses").doc(share.id));
          }
        });
      }
    }
  }

  // ---- 3. Remove their content -----------------------------------------
  // Subcollections are not removed with their parent, so each is cleared
  // explicitly. `summaries` is from the retired long-form feature and may
  // still hold documents on older accounts.
  for (const sub of ["courses", "summaries", "generatedCourses", "aiUsage"]) {
    const docs = await userRef.collection(sub).get();
    while (docs.docs.length) {
      const batch = db.batch();
      for (const d of docs.docs.splice(0, 400)) batch.delete(d.ref);
      await batch.commit();
    }
  }

  for (const [name, field] of [["accessLinks", "uid"], ["invites", "usedByUid"]]) {
    const records = await db.collection(name).where(field, "==", uid).get();
    for (let i = 0; i < records.docs.length; i += 400) {
      const batch = db.batch();
      for (const record of records.docs.slice(i, i + 400)) batch.delete(record.ref);
      await batch.commit();
    }
  }

  // ---- 4. Remove the profile, then the sign-in -------------------------
  await userRef.delete();
  try { await getAdminAuth().deleteUser(uid); } catch (error: any) { if (error.code !== "auth/user-not-found") throw error; }
  return true;
}
