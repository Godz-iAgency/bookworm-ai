import { withAccountLock } from "@/lib/account-lock";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { dissolveClub } from "@/lib/family-server";
import { analyticsRef, firstPaidFields, markFirstPaymentRefunded, paymentIntentOfInvoice } from "@/lib/analytics-server";
export const runtime = "nodejs";

/** Verify the event, then reconcile its subscription against Stripe's current
 * state. Invoice renewal is applied once per period, never per delivery.
 * Failed renewal keeps the existing grace policy; incomplete/unpaid does not
 * create new access. Old subscriptions cannot change a replacement's account.
 *
 * Also records, once, the account's first real payment (the funnel's "paid
 * after the trial"), and a full refund of that payment (charge.refunded).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  let event: Stripe.Event;
  const stripe = getStripe();
  try { event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret); }
  catch { return NextResponse.json({ error: "Invalid signature." }, { status: 400 }); }
  if (event.type === "charge.refunded") {
    try {
      const charge = event.data.object as Stripe.Charge;
      const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
      if (!customerId) return NextResponse.json({ received: true });
      const users = await getAdminDb().collection("users").where("stripeCustomerId", "==", customerId).limit(2).get();
      if (users.size === 1) await markFirstPaymentRefunded(getAdminDb(), users.docs[0].id, charge, new Date(event.created * 1000));
      return NextResponse.json({ received: true });
    } catch (e) {
      console.error("Refund reconciliation failed:", event.id, e);
      return NextResponse.json({ error: "Refund reconciliation failed." }, { status: 500 });
    }
  }
  if (!["customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.trial_will_end", "invoice.payment_succeeded", "invoice.payment_failed"].includes(event.type)) return NextResponse.json({ received: true });
  try {
    const object: any = event.data.object;
    const subValue = event.type.startsWith("invoice.") ? object.parent?.subscription_details?.subscription ?? object.subscription : object.id;
    const subId = typeof subValue === "string" ? subValue : subValue?.id;
    if (!subId) return NextResponse.json({ received: true });
    const sub = await stripe.subscriptions.retrieve(subId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const db = getAdminDb();
    const users = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(2).get();
    if (users.size !== 1) return NextResponse.json({ received: true });
    const ref = users.docs[0].ref;
    // The payment behind a real (non-zero) payment, so a later full refund of
    // it can be matched. Looked up outside the transaction; a failure here
    // only loses refund matching, never the billing update.
    let paidIntent: string | null = null;
    if (event.type === "invoice.payment_succeeded" && object.status === "paid" && Number(object.amount_paid) > 0) {
      paidIntent = paymentIntentOfInvoice(object);
      if (!paidIntent) {
        try { paidIntent = paymentIntentOfInvoice(await stripe.invoices.retrieve(object.id, { expand: ["payments"] })); }
        catch (e) { console.error("Could not read invoice payments:", object.id, e); }
      }
    }
    return await withAccountLock(ref.id, async () => {
    const sub = await stripe.subscriptions.retrieve(subId);
    const plan = planForPriceId(sub.items.data[0]?.price.id ?? "");
    const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
    // Revocation first, and retry it even if a preceding attempt partially ran.
    const profile = (await ref.get()).data()!;
    if (profile.stripeSubscriptionId !== subId) return NextResponse.json({ received: true });
    if (profile.isFamilyOwner && profile.familyId && (!active || plan !== "book_club")) await dissolveClub(db, profile.familyId, ref.id);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const p = snap.data()!;
      if (p.stripeSubscriptionId !== subId) return;
      const receipt = db.collection("stripeEvents").doc(event.id);
      if ((await tx.get(receipt)).exists) return;
      const analytics = event.type === "invoice.payment_succeeded" ? await tx.get(analyticsRef(db, ref.id)) : null;
      const memberDocs = [];
      if (p.isFamilyOwner && p.familyId && active && plan === "book_club") {
        const family = (await tx.get(db.collection("families").doc(p.familyId))).data();
        if (family && family.stripeSubscriptionId === subId && family.status === "active") {
          for (const id of family.memberIds ?? []) if (id !== ref.id) memberDocs.push(await tx.get(db.collection("users").doc(id)));
        }
      }
      const updates: Record<string, unknown> = { billingEventCreated: Math.max(Number(p.billingEventCreated ?? 0), event.created),
        plan: active && plan ? plan : "free",
        trialStatus: sub.status === "trialing" ? "active" : active ? "converted" : "expired",
        subscriptionCancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      };
      if (!active) { updates.stripeSubscriptionId = null; updates.previousSubscriptionId = subId; }
      if (p.isFamilyOwner && (!active || plan !== "book_club")) { updates.familyId = null; updates.isFamilyOwner = false; }
      if (event.type === "customer.subscription.trial_will_end") updates.showTrialEndWarning = true;
      const period = Number(object.lines?.data?.[0]?.period?.end ?? 0);
      if (event.type === "invoice.payment_succeeded" && object.status === "paid") {
        if (sub.status === "active" || sub.status === "trialing") { updates.paymentFailedAt = null; updates.paymentFailureCount = 0; }
        if (object.billing_reason === "subscription_cycle" && period === sub.items.data[0]?.current_period_end && period > Number(p.lastPaidPeriod ?? 0)) {
          updates.lastPaidPeriod = period;
          updates.lastPaidInvoice = object.id;
          updates.monthResetAt = new Date(period * 1000).toISOString();
          if (!p.accessOverride) updates.generationsThisMonth = 0;
          for (const member of memberDocs) if (member.exists && member.data()?.familyId === p.familyId && !member.data()?.accessOverride && period > Number(member.data()?.lastPaidPeriod ?? 0)) tx.update(member.ref, { generationsThisMonth: 0, lastPaidPeriod: period, monthResetAt: updates.monthResetAt });
        }
      }
      if (event.type === "invoice.payment_failed" && sub.status === "past_due") {
        updates.paymentFailedAt = new Date(event.created * 1000).toISOString();
        updates.paymentFailureCount = Number(p.paymentFailureCount ?? 0) + 1;
      }
      tx.update(ref, updates);
      const paid = analytics ? firstPaidFields(analytics.data(), object, paidIntent, event.created) : null;
      if (paid) tx.set(analyticsRef(db, ref.id), paid, { merge: true });
      tx.create(receipt, { created: event.created, type: event.type });
    });
    return NextResponse.json({ received: true });
    });
  } catch (e) {
    console.error("Webhook reconciliation failed:", event.id, e);
    return NextResponse.json({ error: "Webhook reconciliation failed." }, { status: 500 });
  }
}
