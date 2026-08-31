import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, planForPriceId } from "@/lib/stripe/server";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Firestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

async function findUserByCustomerId(db: Firestore, customerId: string) {
  const snap = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

async function findFamilyByCustomerId(db: Firestore, customerId: string) {
  const snap = await db.collection("families").where("stripeCustomerId", "==", customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Not configured yet — acknowledge so Stripe doesn't retry, same inert
    // posture as the rest of the billing routes before setup.
    return NextResponse.json({ received: true, handled: false });
  }

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig ?? "", secret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const db = getAdminDb();

  try {
    switch (event.type) {
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userDoc = await findUserByCustomerId(db, customerId);
        if (userDoc) {
          await userDoc.ref.update({
            showTrialEndWarning: true,
            reminderEmailSentAt: new Date().toISOString(),
          });
          // TODO: send the actual Day-5 reminder email once an email
          // service is wired up — this only flags the in-app banner state.
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = sub.items.data[0]?.price?.id;
        const planId = priceId ? planForPriceId(priceId) : null;

        const userDoc = await findUserByCustomerId(db, customerId);
        if (userDoc) {
          const wasTrial = userDoc.data().trialStatus === "active";
          const updates: Record<string, unknown> = {};
          if (planId) updates.plan = planId;
          if (sub.status === "active" && wasTrial) {
            updates.trialStatus = "converted";
            updates.generationsThisMonth = 0;
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            updates.monthResetAt = d.toISOString();
          }
          if (Object.keys(updates).length > 0) await userDoc.ref.update(updates);
        }

        const familyDoc = await findFamilyByCustomerId(db, customerId);
        if (familyDoc) {
          if (sub.status === "active" && planId === "book_club") {
            await familyDoc.ref.update({ status: "active" });
          } else if (planId && planId !== "book_club") {
            /**
             * The owner's subscription is active but no longer on Book Club,
             * so the shared plan is gone and the club goes with it.
             *
             * This branch used to be the "reactivate" one: it only checked
             * `sub.status === "active"` and ignored WHICH plan the
             * subscription was for. Downgrading from Book Club therefore
             * un-cancelled the family that /api/stripe/upgrade had just
             * cancelled, moments earlier, from the very event the downgrade
             * itself triggered. Caught by an end-to-end test reading the
             * family twice and getting "cancelled" then "active".
             */
            const memberIds: string[] = familyDoc.data().memberIds ?? [];
            await familyDoc.ref.update({ status: "cancelled" });
            const batch = db.batch();
            for (const memberId of memberIds) {
              batch.update(db.collection("users").doc(memberId), {
                familyId: null,
                isFamilyOwner: false,
              });
            }
            await batch.commit();
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Each successful renewal starts a fresh billing period, so the
        // monthly generation allowance resets here. This is the ONLY place
        // the counter rolls over — without it, `monthResetAt` would stay in
        // the past forever and canGenerate() would stop capping anything.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const periodEnd = invoice.lines?.data?.[0]?.period?.end;
        const nextReset = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : (() => {
              const d = new Date();
              d.setMonth(d.getMonth() + 1);
              return d.toISOString();
            })();

        const userDoc = await findUserByCustomerId(db, customerId);
        if (userDoc) {
          await userDoc.ref.update({ generationsThisMonth: 0, monthResetAt: nextReset });
        }

        // Book Club: every member's allowance is individual, so all of them
        // reset when the owner's subscription renews.
        const familyDoc = await findFamilyByCustomerId(db, customerId);
        if (familyDoc) {
          const memberIds: string[] = familyDoc.data().memberIds ?? [];
          const batch = db.batch();
          for (const memberId of memberIds) {
            batch.update(db.collection("users").doc(memberId), {
              generationsThisMonth: 0,
              monthResetAt: nextReset,
            });
          }
          await batch.commit();
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const userDoc = await findUserByCustomerId(db, customerId);
        if (userDoc) {
          const wasTrial = userDoc.data().trialStatus === "active";
          await userDoc.ref.update({
            plan: "free",
            trialStatus: wasTrial ? "cancelled" : "expired",
            stripeSubscriptionId: null,
          });
        }

        // Book Club cancellation revokes every member's access, not just the
        // owner's — access checks only ever read the member's own user doc
        // (see lib/billing.ts), so clearing familyId there is what actually
        // takes access away.
        const familyDoc = await findFamilyByCustomerId(db, customerId);
        if (familyDoc) {
          const memberIds: string[] = familyDoc.data().memberIds ?? [];
          await familyDoc.ref.update({ status: "cancelled" });
          const batch = db.batch();
          for (const memberId of memberIds) {
            batch.update(db.collection("users").doc(memberId), { familyId: null, isFamilyOwner: false });
          }
          await batch.commit();
        }
        break;
      }

      default:
        break;
    }
  } catch (err: any) {
    console.error(`Webhook handler failed for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true, handled: true });
}
