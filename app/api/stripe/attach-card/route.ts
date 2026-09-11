import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";

/**
 * Save a card the browser has just confirmed via SetupIntent, without starting
 * a trial.
 *
 * /api/stripe/activate-trial already does this, but only on its way into a
 * Page Turner trial. A removed Book Club member converting straight to a paid
 * plan has no card on file and is not entitled to a second trial, and
 * /api/stripe/upgrade requires a saved payment method before it will
 * subscribe anyone. This is the missing step between the two.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    const { paymentMethodId } = await req.json();
    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return NextResponse.json({ error: "Missing paymentMethodId." }, { status: 400 });
    }

    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const customerId = snap.data()!.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "No Stripe customer on file — start card setup first." },
        { status: 400 },
      );
    }

    await getStripe().customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    await userRef.update({ stripePaymentMethodId: paymentMethodId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("attach-card failed:", error);
    return NextResponse.json({ error: error.message || "Could not save your card." }, { status: 500 });
  }
}
