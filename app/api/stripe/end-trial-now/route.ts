import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getAdminDb, getUidFromRequest } from "@/lib/firebase/admin";

/**
 * "Keep Learning" CTA on the dashboard trial banner — lets an eager user
 * convert their trial to paid immediately instead of waiting for Day 7.
 * Firestore stays untouched here; the resulting `customer.subscription.updated`
 * webhook event is the single source of truth for flipping trialStatus.
 */
export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    if (!uid) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const db = getAdminDb();
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const user = snap.data()!;
    if (user.trialStatus !== "active" || !user.stripeSubscriptionId) {
      return NextResponse.json({ error: "No active trial to end." }, { status: 400 });
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(user.stripeSubscriptionId, { trial_end: "now" });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("end-trial-now failed:", error);
    return NextResponse.json({ error: error.message || "Could not end trial." }, { status: 500 });
  }
}
