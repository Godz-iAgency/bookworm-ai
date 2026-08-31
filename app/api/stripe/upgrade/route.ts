import { NextResponse } from "next/server";
import { getStripe, priceIdForPlan, type PlanId } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const VALID_PLANS: PlanId[] = ["page_turner", "well_read", "book_club"];

function oneMonthFromNow(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/**
 * Switches an existing subscriber to a different tier (immediate paid
 * switch, not a new trial — the trial only ever runs on Page Turner). If the
 * user has no subscription yet, requires they already have a saved card
 * (from a prior trial) and starts one fresh, charging immediately.
 * For `book_club`, also creates the /families/{familyId} doc with this user
 * as owner and sole member so far.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { targetPlan } = await req.json();
    if (!VALID_PLANS.includes(targetPlan)) {
      return NextResponse.json({ error: "Invalid targetPlan." }, { status: 400 });
    }

    const stripe = getStripe();
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const user = snap.data()!;
    const priceId = priceIdForPlan(targetPlan as PlanId);

    let subscriptionId: string = user.stripeSubscriptionId ?? "";
    if (subscriptionId) {
      const existing = await stripe.subscriptions.retrieve(subscriptionId);
      const itemId = existing.items.data[0]?.id;
      if (!itemId) {
        return NextResponse.json({ error: "Existing subscription has no items." }, { status: 500 });
      }
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        // If they're mid-trial, upgrading tiers ends the trial immediately
        // (an upgrade is a deliberate paid commitment) — otherwise omit so
        // Stripe doesn't touch an already-converted subscription's billing.
        ...(existing.status === "trialing" ? { trial_end: "now" as const } : {}),
      });
    } else {
      if (!user.stripeCustomerId || !user.stripePaymentMethodId) {
        return NextResponse.json(
          { error: "No saved payment method — start card setup before upgrading." },
          { status: 400 },
        );
      }
      const created = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: user.stripePaymentMethodId,
      });
      subscriptionId = created.id;
    }

    const updates: Record<string, unknown> = {
      plan: targetPlan,
      trialStatus: "converted",
      stripeSubscriptionId: subscriptionId,
      generationsThisMonth: 0,
      monthResetAt: oneMonthFromNow(),
    };

    if (targetPlan === "book_club" && !user.familyId) {
      const familyRef = db.collection("families").doc();
      await familyRef.set({
        ownerId: uid,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
        memberIds: [uid],
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });
      updates.familyId = familyRef.id;
      updates.isFamilyOwner = true;
    } else if (targetPlan !== "book_club" && user.isFamilyOwner && user.familyId) {
      // Leaving Book Club as its owner. getEffectivePlanId checks familyId
      // before plan, so without this the account would be reported as
      // "on Book Club" forever no matter what plan is chosen next — the
      // switch would succeed on Stripe but look like it silently failed here.
      const familyRef = db.collection("families").doc(user.familyId);
      const famSnap = await familyRef.get();
      const memberIds: string[] = famSnap.data()?.memberIds ?? [];

      await familyRef.update({
        status: "cancelled",
        cancelledAt: FieldValue.serverTimestamp(),
      });

      // Every member's familyId has to be cleared, not just the owner's.
      // Access is granted on the mere PRESENCE of familyId (see
      // getEffectivePlanId in lib/billing.ts) - it never reads the family's
      // status - so marking the family cancelled on its own revokes nothing.
      // The members carried on with full Book Club access while the owner had
      // dropped to a $9.99 plan, indefinitely and silently.
      const memberBatch = db.batch();
      for (const memberId of memberIds) {
        if (memberId === uid) continue; // the owner is covered by `updates`
        memberBatch.update(db.collection("users").doc(memberId), {
          familyId: null,
          isFamilyOwner: false,
        });
      }
      await memberBatch.commit();

      updates.familyId = null;
      updates.isFamilyOwner = false;
    }

    await userRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("upgrade failed:", error);
    return NextResponse.json({ error: error.message || "Could not upgrade plan." }, { status: 500 });
  }
}
