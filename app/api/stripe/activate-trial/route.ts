import { NextResponse } from "next/server";
import { getStripe, priceIdForPlan } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";

/**
 * Soft-gate step 2: called after the browser confirms the SetupIntent (card
 * saved). Sets the card as default, starts a 7-day-trial subscription on
 * Page Turner — the only tier the trial ever runs on — and writes the trial
 * fields to Firestore via the Admin SDK (never the client SDK; see
 * lib/firebase/admin.ts for why).
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { paymentMethodId } = await req.json();
    if (!paymentMethodId) {
      return NextResponse.json({ error: "Missing paymentMethodId." }, { status: 400 });
    }

    const stripe = getStripe();
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const user = snap.data()!;
    const customerId = user.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json({ error: "No Stripe customer on file — start card setup first." }, { status: 400 });
    }

    // Idempotency guard: a retry (or a double-submitted soft gate) must never
    // create a second subscription — that would bill the customer twice.
    if (user.stripeSubscriptionId) {
      return NextResponse.json({
        success: true,
        alreadyActive: true,
        trialEndsAt: user.trialEndsAt ?? null,
      });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceIdForPlan("page_turner") }],
      trial_period_days: 7,
      default_payment_method: paymentMethodId,
    });

    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await userRef.update({
      plan: "page_turner",
      trialStatus: "active",
      trialStartedAt: new Date().toISOString(),
      trialEndsAt,
      stripeSubscriptionId: subscription.id,
      stripePaymentMethodId: paymentMethodId,
      generationsThisMonth: 0,
      showTrialEndWarning: false,
    });

    return NextResponse.json({ success: true, trialEndsAt });
  } catch (error: any) {
    console.error("activate-trial failed:", error);
    return NextResponse.json({ error: error.message || "Could not start trial." }, { status: 500 });
  }
}
