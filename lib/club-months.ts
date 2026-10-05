import type { Firestore } from "firebase-admin/firestore";

const MONTH_MS = 30 * 86400000;

/**
 * Monthly book counts for members of a Book Club whose owner pays nothing.
 *
 * A club member's counter normally goes back to zero when the owner's Stripe
 * invoice is paid (app/api/stripe/webhook). A club owned by a complimentary
 * account has no invoice, so that reset never happens and the members' counts
 * would only ever go up. This gives them the same thing on a clock instead:
 * every 30 days from the first time it runs.
 *
 * Only members of a club with a complimentary owner are touched, and never a
 * member with a complimentary override or a subscription of their own. The
 * reset happens here, on the server, never in the reader's browser, so nobody
 * can reach a new month early.
 */
export async function rollFreeClubMonths(db: Firestore, now = Date.now()): Promise<{ started: number; reset: number }> {
  let started = 0;
  let reset = 0;
  const clubs = await db.collection("families").where("status", "==", "active").get();
  for (const club of clubs.docs) {
    const { ownerId, memberIds } = club.data();
    const owner = ownerId ? (await db.collection("users").doc(ownerId).get()).data() : null;
    if (!owner?.accessOverride?.active) continue;
    for (const id of memberIds ?? []) {
      if (id === ownerId) continue;
      const ref = db.collection("users").doc(id);
      await db.runTransaction(async (tx) => {
        const m = (await tx.get(ref)).data();
        if (!m || m.accessOverride || m.stripeSubscriptionId || m.familyId !== club.id) return;
        const due = Date.parse(m.monthResetAt ?? "");
        if (Number.isFinite(due) && due > now) return;
        const next = new Date(now + MONTH_MS).toISOString();
        if (Number.isFinite(due)) {
          tx.update(ref, { generationsThisMonth: 0, monthResetAt: next });
          reset++;
        } else {
          // No month on record yet: the first one starts now, with the count as it is.
          tx.update(ref, { monthResetAt: next });
          started++;
        }
      });
    }
  }
  return { started, reset };
}
