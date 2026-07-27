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

export function getPlanLimits(planId: Plan["id"] | "free"): { maxOpenBooks: number; monthlyGenerations: number } {
  if (planId === "free") return { maxOpenBooks: 0, monthlyGenerations: 0 };
  const plan = planFromId(planId);
  return { maxOpenBooks: plan.maxOpenBooks, monthlyGenerations: plan.monthlyGenerations };
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
