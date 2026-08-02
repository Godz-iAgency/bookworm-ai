import { NextResponse } from "next/server";
import { getStripe, priceIdForPlan, type PlanId } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";

const VALID_PLANS: PlanId[] = ["page_turner", "well_read", "book_club"];

/**
 * What switching to `targetPlan` would actually cost, before committing to it.
 *
 * Two genuinely different outcomes, and the reader is owed the right one:
 *
 *  - Mid-trial, or no subscription yet: /api/stripe/upgrade ends the trial
 *    immediately (`trial_end: "now"`), so the new plan's full price is charged
 *    TODAY. Reported as mode "charge_now".
 *  - Already a paying subscriber: the switch uses `create_prorations`, which
 *    does NOT charge today — Stripe puts the prorated difference on the next
 *    scheduled invoice. Reported as mode "next_invoice" with that invoice's
 *    real total and date, taken from Stripe's own preview rather than
 *    arithmetic of ours.
 *
 * Read-only: this never mutates the subscription.
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
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const user = snap.data()!;
    const priceId = priceIdForPlan(targetPlan as PlanId);
    const subscriptionId: string = user.stripeSubscriptionId ?? "";

    // No live subscription — upgrading creates one and bills it right away.
    if (!subscriptionId) {
      const price = await stripe.prices.retrieve(priceId);
      return NextResponse.json({
        mode: "charge_now",
        amount: price.unit_amount ?? 0,
        currency: price.currency ?? "usd",
      });
    }

    const existing = await stripe.subscriptions.retrieve(subscriptionId);
    const item = existing.items.data[0];
    if (!item) {
      return NextResponse.json({ error: "Existing subscription has no items." }, { status: 500 });
    }

    // Mid-trial: upgrading is a deliberate paid commitment, so the trial ends
    // and the full price lands today. Stripe's preview can't model an ended
    // trial (subscription_details has no trial_end), so read the price itself
    // rather than reporting a $0 preview that would be flatly wrong.
    if (existing.status === "trialing") {
      const price = await stripe.prices.retrieve(priceId);
      return NextResponse.json({
        mode: "charge_now",
        amount: price.unit_amount ?? 0,
        currency: price.currency ?? "usd",
        endsTrial: true,
      });
    }

    const preview = await stripe.invoices.createPreview({
      customer: user.stripeCustomerId,
      subscription: subscriptionId,
      subscription_details: {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
      },
    });

    // current_period_end moved onto the subscription item in recent API
    // versions; fall back across both shapes so the date is never missing.
    const periodEnd =
      (item as unknown as { current_period_end?: number }).current_period_end ??
      (existing as unknown as { current_period_end?: number }).current_period_end ??
      preview.period_end ??
      null;

    return NextResponse.json({
      mode: "next_invoice",
      amount: preview.amount_due ?? preview.total ?? 0,
      currency: preview.currency ?? "usd",
      nextInvoiceAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });
  } catch (error: any) {
    console.error("preview-upgrade failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not preview this change." },
      { status: 500 },
    );
  }
}
