"use client";

import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase/config";
import { PLANS, planFromId, type Plan } from "./plans";

/**
 * Billing-relevant slice of the /users/{uid} doc. Dates are stored as ISO
 * strings (matching Course.expiresAt elsewhere in the app), not Firestore
 * Timestamps, so this shape is plain-JSON and safe to pass around freely.
 */
export interface BillingProfile {
  plan: string | null;
  trialStatus: "active" | "converted" | "cancelled" | "expired" | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentMethodId: string | null;
  generationsThisMonth: number;
  monthResetAt: string | null;
  familyId: string | null;
  isFamilyOwner: boolean;
  showTrialEndWarning: boolean;
  /** Set when the reader has cancelled: access runs until this date, then stops. */
  subscriptionCancelAt: string | null;
  /** Set by the invoice.payment_failed webhook, cleared when a payment succeeds. */
  paymentFailedAt: string | null;
}

/** The number of books a trial user may generate for the whole 7-day trial — flat, not tier-based. */
export const TRIAL_GENERATION_CAP = 3;

export async function getBillingProfile(uid: string): Promise<BillingProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    plan: d.plan ?? "free",
    trialStatus: d.trialStatus ?? null,
    trialStartedAt: d.trialStartedAt ?? null,
    trialEndsAt: d.trialEndsAt ?? null,
    stripeCustomerId: d.stripeCustomerId ?? null,
    stripeSubscriptionId: d.stripeSubscriptionId ?? null,
    stripePaymentMethodId: d.stripePaymentMethodId ?? null,
    generationsThisMonth: d.generationsThisMonth ?? 0,
    monthResetAt: d.monthResetAt ?? null,
    familyId: d.familyId ?? null,
    isFamilyOwner: d.isFamilyOwner ?? false,
    showTrialEndWarning: d.showTrialEndWarning ?? false,
    subscriptionCancelAt: d.subscriptionCancelAt ?? null,
    paymentFailedAt: d.paymentFailedAt ?? null,
  };
}

/** Book Club members inherit the tier from their family regardless of their own `plan` field. */
export function getEffectivePlanId(profile: Pick<BillingProfile, "plan" | "familyId">): Plan["id"] | "free" {
  if (profile.familyId) return "book_club";
  if (profile.plan && profile.plan !== "free") return profile.plan as Plan["id"];
  return "free";
}

/** Does this user currently have generation/dashboard access — trial running, paid, or a family member? */
export function hasActiveAccess(profile: Pick<BillingProfile, "trialStatus" | "plan" | "familyId">): boolean {
  return profile.trialStatus === "active" || (!!profile.plan && profile.plan !== "free") || !!profile.familyId;
}

/**
 * A tier's shelf + quota limits. "free" maps to the entry tier rather than
 * zero: the shelf cap is a plan *feature* limit, not the paywall. Payment is
 * enforced at generation time by the soft gate (hasActiveAccess / canGenerate)
 * — returning 0 here would instead brick the "+" button for every user who
 * hasn't subscribed yet, including before billing is even switched on.
 */
export function getPlanLimits(planId: Plan["id"] | "free"): { maxOpenBooks: number; monthlyGenerations: number } {
  const plan = planFromId(planId === "free" ? "page_turner" : planId);
  return { maxOpenBooks: plan.maxOpenBooks, monthlyGenerations: plan.monthlyGenerations };
}

/**
 * Whether Stripe is actually wired up. Until keys exist, the soft gate can't
 * collect a card, so the app must keep working exactly as it did pre-billing
 * rather than dead-ending users at a form that can't submit.
 *
 * NEXT_PUBLIC_BILLING_PAUSED is a manual kill switch on top of that, for the
 * case where Stripe's keys are present but the Firebase Admin credential the
 * soft gate needs (see lib/firebase/admin.ts) is broken on this deployment —
 * that turned every course generation into a dead-end trial screen. Flip it
 * back off once /api/health/billing reports ready: true.
 */
export function isBillingEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_BILLING_PAUSED === "true") return false;
  return !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

/**
 * Whether the user can generate another book right now. During an active
 * trial the cap is always 3 total for the trial (flat, regardless of tier —
 * trial only ever runs on Page Turner). Once the trial has converted (or for
 * an existing paid/family member with no trial in progress), the tier's real
 * monthly quota applies, resetting when `monthResetAt` has passed.
 */
export function canGenerate(
  profile: Pick<BillingProfile, "trialStatus" | "plan" | "familyId" | "generationsThisMonth" | "monthResetAt">,
): { allowed: boolean; reason?: string } {
  if (!hasActiveAccess(profile)) {
    return { allowed: false, reason: "no_access" };
  }

  if (profile.trialStatus === "active") {
    if (profile.generationsThisMonth >= TRIAL_GENERATION_CAP) {
      return { allowed: false, reason: "trial_cap" };
    }
    return { allowed: true };
  }

  // `monthResetAt` is when the current billing period ends. The counter is
  // rolled over server-side by the invoice.payment_succeeded webhook — never
  // here. If that date has passed but the counter hasn't reset yet, the
  // webhook is merely in flight, so we keep counting against the quota
  // (fail closed). Zeroing it client-side instead would hand out unlimited
  // generations to anyone whose webhook never arrives.
  const { monthlyGenerations } = getPlanLimits(getEffectivePlanId(profile));
  if (profile.generationsThisMonth >= monthlyGenerations) {
    return { allowed: false, reason: "monthly_cap" };
  }
  return { allowed: true };
}

export { PLANS, planFromId };
export type { Plan };
