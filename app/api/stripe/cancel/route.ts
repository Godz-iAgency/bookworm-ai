import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";

/**
 * Cancel (or un-cancel) a subscription at the end of the paid period.
 *
 * Deliberately NOT an immediate cancellation. The reader has already paid
 * through the end of this billing period, so taking their books away the
 * moment they tap Cancel would be taking something they own. Stripe stops the
 * renewal instead, access runs out naturally, and until then the choice is
 * reversible - which is also what keeps a mis-tap from being a disaster.
 *
 * Access itself needs no special handling: when the period ends Stripe fires
 * customer.subscription.deleted, and that handler already downgrades the user
 * and tears down a Book Club properly.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { resume } = await req.json().catch(() => ({ resume: false }));

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const user = snap.data()!;

    if (!user.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "There's no active subscription on this account." },
        { status: 400 }
      );
    }

    // A Book Club member has no subscription of their own; the owner pays.
    // Guarding here stops a member from cancelling somebody else's plan.
    if (user.familyId && !user.isFamilyOwner) {
      return NextResponse.json(
        { error: "Your Book Club is billed to whoever invited you. Ask them to change it." },
        { status: 403 }
      );
    }

    const stripe = getStripe();
    const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: !resume,
    });

    // `current_period_end` moved onto the subscription item in recent API
    // versions; read both shapes so the date shown is never missing.
    const item = updated.items.data[0] as unknown as { current_period_end?: number };
    const periodEnd =
      item?.current_period_end ??
      (updated as unknown as { current_period_end?: number }).current_period_end ??
      null;
    const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

    await userRef.update({
      subscriptionCancelAt: resume ? null : endsAt,
    });

    return NextResponse.json({ success: true, cancelAtPeriodEnd: !resume, endsAt });
  } catch (error: any) {
    console.error("subscription cancel failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not change your subscription." },
      { status: 500 }
    );
  }
}
