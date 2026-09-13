import { NextResponse } from "next/server";
import { getAdminDb, getAuthedUser } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe/server";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface AdminCharge {
  id: string;
  amount: number;
  currency: string;
  created: number;
  status: string;
  description: string | null;
  refunded: boolean;
  amountRefunded: number;
  receiptUrl: string | null;
  customerEmail: string | null;
  customerId: string | null;
  /** The Bookworm account this charge belongs to, when we can match one. */
  uid: string | null;
  disputed: boolean;
}

/**
 * Money, as Stripe actually has it — and the one button that gives it back.
 *
 * Deliberately read from Stripe rather than from Firestore. Firestore records
 * what the app believes about a subscription; Stripe records what was charged,
 * and when those two disagree the whole point of looking is to find out which.
 *
 * `action: "refund"` is the only write. It is not a toggle and it cannot be
 * undone from here or from Stripe, so it refuses anything ambiguous: an
 * unknown charge, one already fully refunded, or an amount that isn't a
 * positive number of cents within what's left.
 */
export async function POST(req: Request) {
  try {
    const caller = await getAuthedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!isAdminEmail(caller.email)) {
      return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    }

    const stripe = getStripe();
    const body = await req.json().catch(() => ({ action: "list" }));

    if (body.action === "refund") {
      const { chargeId } = body;
      if (!chargeId || typeof chargeId !== "string") {
        return NextResponse.json({ error: "Missing charge." }, { status: 400 });
      }

      const charge = await stripe.charges.retrieve(chargeId);
      const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
      const owners = customerId
        ? await getAdminDb().collection("users").where("stripeCustomerId", "==", customerId).limit(2).get()
        : null;
      if (!owners || owners.size !== 1 || charge.disputed) {
        return NextResponse.json({ error: "Charge is not an undisputed Bookworm payment." }, { status: 400 });
      }
      if (!charge || charge.status !== "succeeded") {
        return NextResponse.json({ error: "That charge can't be refunded." }, { status: 400 });
      }
      const remaining = charge.amount - charge.amount_refunded;
      if (remaining <= 0) {
        return NextResponse.json({ error: "That charge is already fully refunded." }, { status: 400 });
      }

      // Full refund of whatever is left. A partial refund is a different
      // decision with a different conversation behind it, and guessing at one
      // from a dashboard button is how you refund the wrong number.
      const refund = await stripe.refunds.create({
        charge: chargeId,
        reason: "requested_by_customer",
        metadata: { refundedBy: caller.email ?? "admin" },
      }, { idempotencyKey: `bookworm-full-refund-${chargeId}` });

      return NextResponse.json({
        success: true,
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
      });
    }

    // ---- list -------------------------------------------------------------
    // Charges carry the customer, so one page of them covers the recent money
    // without walking every customer who ever existed.
    const charges = await stripe.charges.list({ limit: 50, expand: ["data.customer"] });

    // Match Stripe customers back to Bookworm accounts so a refund is
    // attributable to a reader rather than to an opaque cus_ id.
    const profilesSnap = await getAdminDb().collection("users").get();
    const byCustomerId = new Map<string, { uid: string; email: string | null }>();
    for (const doc of profilesSnap.docs) {
      const customerId = doc.data().stripeCustomerId;
      if (customerId) byCustomerId.set(customerId, { uid: doc.id, email: doc.data().email ?? null });
    }

    const list: AdminCharge[] = charges.data.map((c) => {
      const customerId = typeof c.customer === "string" ? c.customer : (c.customer?.id ?? null);
      const matched = customerId ? byCustomerId.get(customerId) : undefined;
      const customerEmail =
        matched?.email ??
        c.billing_details?.email ??
        (c.customer && typeof c.customer !== "string" && !("deleted" in c.customer)
          ? c.customer.email
          : null);

      return {
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        created: c.created,
        status: c.status,
        description: c.description ?? null,
        refunded: c.refunded,
        amountRefunded: c.amount_refunded,
        receiptUrl: c.receipt_url ?? null,
        customerEmail: customerEmail ?? null,
        customerId,
        uid: matched?.uid ?? null,
        disputed: c.disputed,
      };
    });

    const succeeded = list.filter((c) => c.status === "succeeded");
    return NextResponse.json({
      charges: list,
      summary: {
        grossCents: succeeded.reduce((n, c) => n + c.amount, 0),
        refundedCents: list.reduce((n, c) => n + c.amountRefunded, 0),
        netCents: succeeded.reduce((n, c) => n + c.amount - c.amountRefunded, 0),
        count: succeeded.length,
        disputes: list.filter((c) => c.disputed).length,
      },
    });
  } catch (error: any) {
    console.error("admin payments failed:", error);
    return NextResponse.json({ error: error.message || "Could not load payments." }, { status: 500 });
  }
}
