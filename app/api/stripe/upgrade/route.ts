import { withAccountLock } from "@/lib/account-lock";
import { NextResponse } from "next/server";
import { getStripe, priceIdForPlan, planForPriceId, type PlanId } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { dissolveClub } from "@/lib/family-server";

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
async function handle(req: Request) {
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
    if (user.accessOverride) return NextResponse.json({ error: "This account has complimentary access." }, { status: 403 });
    const priceId = priceIdForPlan(targetPlan as PlanId);

    let subscriptionId: string = user.stripeSubscriptionId ?? "";
    if (!subscriptionId && user.stripeCustomerId) {
      const subscriptions = await stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 100 });
      const live = subscriptions.data.filter(s => !["canceled", "incomplete_expired", "unpaid"].includes(s.status) && planForPriceId(s.items.data[0]?.price.id ?? ""));
      if (live.length > 1 || subscriptions.has_more) throw new Error("Subscription history needs review before another charge.");
      subscriptionId = live[0]?.id ?? "";
    }
    if (subscriptionId) {
      const existing = await stripe.subscriptions.retrieve(subscriptionId);
      if (existing.status === "active" && existing.items.data[0]?.price.id === priceId && user.stripeSubscriptionId === existing.id && user.plan === targetPlan) return NextResponse.json({ success: true });
      const itemId = existing.items.data[0]?.id;
      if (!itemId) {
        return NextResponse.json({ error: "Existing subscription has no items." }, { status: 500 });
      }
      await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        payment_behavior: "error_if_incomplete",
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
        payment_behavior: "error_if_incomplete",
        metadata: { firebaseUid: uid },
      }, { idempotencyKey: `bookworm-subscription-${uid}-${user.previousSubscriptionId ?? "initial"}-${targetPlan}` });
      subscriptionId = created.id;
    }

    const updates: Record<string, unknown> = {
      plan: targetPlan,
      trialStatus: "converted",
      stripeSubscriptionId: subscriptionId,
      // Mid-period switches preserve usage; only a paid renewal resets it.
      // Choosing a plan calls off any pending Book Club deletion. Harmless for
      // everyone else — they never had one set.
      bookClubRemovedAt: null,
      bookClubDeleteAt: null,
    };

    if (targetPlan === "book_club" && !user.familyId) {
      const familyRef = db.collection("families").doc(subscriptionId);
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
      //
      // Every member's familyId has to be cleared, not just the owner's, and
      // the shared shelf has to go with it. Access is granted on the mere
      // PRESENCE of familyId (see getEffectivePlanId in lib/billing.ts) and a
      // shared book is read through a copy in the member's own collection —
      // so marking the family cancelled on its own revokes nothing. The
      // members carried on with full Book Club access while the owner had
      // dropped to a $9.99 plan, indefinitely and silently.
      await dissolveClub(db, user.familyId, uid);

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

export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    return await withAccountLock(uid, () => handle(req));
  } catch (error: any) { return NextResponse.json({ error: error.message || "Account operation failed." }, { status: 409 }); }
}
