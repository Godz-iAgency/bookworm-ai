import type { Firestore } from "firebase-admin/firestore";
import { cleanSourceCode } from "./funnel";

/**
 * Funnel milestones the rest of the database does not already record.
 *
 * One document per account at analyticsUsers/{uid}, written only by the Admin
 * SDK (firestore.rules denies clients anything it does not name, and it does
 * not name this collection). Each milestone is a field that is set once and
 * never overwritten, inside a transaction, so a refresh, a double tap, a
 * retried request or a webhook Stripe delivers twice cannot count anything
 * twice: the second write finds the field already there and does nothing.
 *
 * What is NOT here, because reliable records already exist:
 *   - card added / trial started: users/{uid}.trialStartedAt
 *   - books generated: users/{uid}/generatedCourses, consumed = saved
 *
 * Fields:
 *   day1ActivatedAt, day1CourseId, day1ReadingLevel, day1Language
 *   attribution: { source, campaign, capturedAt }
 *   firstPaidAt, firstPaidInvoice, firstPaidAmount, firstPaidPaymentIntent
 *   paidRefundedAt
 *   paidBackfillCheckedAt  (the one-time Stripe lookup for older accounts ran)
 */
export const ANALYTICS_COLLECTION = "analyticsUsers";

export const analyticsRef = (db: Firestore, uid: string) => db.collection(ANALYTICS_COLLECTION).doc(uid);

/** Attribution is only accepted for accounts this new, so an old reader who
 * clicks a creator's link later is not suddenly credited to that creator. */
export const ATTRIBUTION_MAX_ACCOUNT_AGE_MS = 7 * 24 * 3600_000;

const COURSE_ID = /^[a-zA-Z0-9-]{1,100}$/;

/**
 * Day 1 of the reader's first course, started. Once per account, ever: the
 * first book's Day 1 is the activation moment, and later books do not move it.
 * The course has to be one this account generated (its generation ticket
 * exists), so a Book Club member reading someone else's shared book does not
 * count, and nobody can activate on a made-up id.
 */
export async function recordDay1Activation(db: Firestore, uid: string, courseId: unknown, now = new Date()) {
  if (typeof courseId !== "string" || !COURSE_ID.test(courseId)) return { recorded: false, reason: "invalid" as const };
  const ref = analyticsRef(db, uid);
  const ticketRef = db.collection("users").doc(uid).collection("generatedCourses").doc(courseId);
  return db.runTransaction(async (tx) => {
    const [a, ticket] = await Promise.all([tx.get(ref), tx.get(ticketRef)]);
    if (a.data()?.day1ActivatedAt) return { recorded: false, reason: "already" as const };
    const tk = ticket.data();
    if (!tk) return { recorded: false, reason: "unknown-course" as const };
    tx.set(ref, {
      day1ActivatedAt: now.toISOString(),
      day1CourseId: courseId,
      day1ReadingLevel: typeof tk.readingLevel === "string" ? tk.readingLevel : null,
      day1Language: typeof tk.language === "string" ? tk.language : "en",
    }, { merge: true });
    return { recorded: true as const };
  });
}

/**
 * The creator code an account arrived with. First touch wins and is never
 * replaced; only brand-new accounts can be attributed.
 */
export async function recordAttribution(
  db: Firestore,
  uid: string,
  input: { source?: unknown; campaign?: unknown },
  accountCreatedAt: string | undefined,
  now = new Date(),
) {
  const source = cleanSourceCode(input.source);
  if (!source) return { recorded: false, reason: "invalid" as const };
  const created = accountCreatedAt ? Date.parse(accountCreatedAt) : NaN;
  if (!Number.isFinite(created) || now.getTime() - created > ATTRIBUTION_MAX_ACCOUNT_AGE_MS) {
    return { recorded: false, reason: "account-too-old" as const };
  }
  const campaign = cleanSourceCode(input.campaign);
  const ref = analyticsRef(db, uid);
  return db.runTransaction(async (tx) => {
    const a = await tx.get(ref);
    if (a.data()?.attribution?.source) return { recorded: false, reason: "already" as const };
    tx.set(ref, { attribution: { source, campaign, capturedAt: now.toISOString() } }, { merge: true });
    return { recorded: true as const };
  });
}

/**
 * The fields to write when Stripe reports a paid invoice, or null when this
 * invoice is not the account's first real payment. $0 invoices (the one a
 * trial opens with) never count; neither does anything after the first.
 */
export function firstPaidFields(
  existing: Record<string, any> | undefined,
  invoice: { id?: string; status?: string; amount_paid?: number; status_transitions?: { paid_at?: number | null } | null; created?: number },
  paymentIntentId: string | null,
  eventCreated: number,
): Record<string, unknown> | null {
  if (existing?.firstPaidAt) return null;
  if (invoice.status !== "paid" || !(Number(invoice.amount_paid) > 0)) return null;
  const paidAt = Number(invoice.status_transitions?.paid_at) || Number(invoice.created) || eventCreated;
  return {
    firstPaidAt: new Date(paidAt * 1000).toISOString(),
    firstPaidInvoice: invoice.id ?? null,
    firstPaidAmount: Number(invoice.amount_paid),
    firstPaidPaymentIntent: paymentIntentId,
  };
}

/** The payment intent behind a paid invoice (newer Stripe API versions keep it
 * under invoice.payments rather than on the invoice itself). */
export function paymentIntentOfInvoice(invoice: any): string | null {
  const direct = invoice?.payment_intent;
  if (direct) return typeof direct === "string" ? direct : direct.id ?? null;
  for (const p of invoice?.payments?.data ?? []) {
    const pi = p?.payment?.payment_intent;
    if (pi && (p.status === "paid" || !p.status)) return typeof pi === "string" ? pi : pi.id ?? null;
  }
  return null;
}

/**
 * A full refund of the account's first payment turns its paid conversion back
 * into a no. Partial refunds leave it counted. Safe to call for any refund:
 * it only acts when the refunded payment is that first one.
 */
export async function markFirstPaymentRefunded(
  db: Firestore,
  uid: string,
  charge: { payment_intent?: unknown; refunded?: boolean; amount?: number; amount_refunded?: number },
  now = new Date(),
) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : (charge.payment_intent as any)?.id;
  const full = charge.refunded === true || (Number(charge.amount) > 0 && Number(charge.amount_refunded) >= Number(charge.amount));
  if (!pi || !full) return false;
  const ref = analyticsRef(db, uid);
  return db.runTransaction(async (tx) => {
    const a = (await tx.get(ref)).data();
    if (!a?.firstPaidAt || a.paidRefundedAt || a.firstPaidPaymentIntent !== pi) return false;
    tx.set(ref, { paidRefundedAt: now.toISOString() }, { merge: true });
    return true;
  });
}
