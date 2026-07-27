"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postAuthed } from "@/lib/api-client";
import { planFromId } from "@/lib/plans";
import type { BillingProfile } from "@/lib/billing";

/**
 * The trial countdown banner (doc4_trial_summary.md). Escalates from neutral
 * to amber to red as Day 7 approaches. Early on the CTA sends the reader to
 * /pricing to pick a tier; in the final 48 hours it converts the trial
 * immediately so an eager reader doesn't have to wait for the charge.
 */
export default function TrialBanner({
  profile,
  onConverted,
}: {
  profile: BillingProfile;
  onConverted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (profile.trialStatus !== "active" || !profile.trialEndsAt) return null;

  const msLeft = new Date(profile.trialEndsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const entryPrice = planFromId("page_turner").price;

  let message: string;
  let tone: "neutral" | "amber" | "red";
  let ctaLabel: string;
  let convertNow = false;

  if (daysLeft <= 0) {
    message = "Your trial ends today.";
    tone = "red";
    ctaLabel = `Keep Learning — ${entryPrice}/month`;
    convertNow = true;
  } else if (daysLeft === 1) {
    message = "Your trial ends tomorrow. Your book disappears at midnight.";
    tone = "red";
    ctaLabel = `Keep Learning — ${entryPrice}/month`;
    convertNow = true;
  } else if (daysLeft <= 3) {
    message = `Your trial ends in ${daysLeft} days — your book disappears with it.`;
    tone = "amber";
    ctaLabel = "Upgrade Now";
  } else if (profile.showTrialEndWarning) {
    message = `Your trial ends in ${daysLeft} days. A reminder is in your inbox.`;
    tone = "neutral";
    ctaLabel = "Upgrade Now";
  } else {
    message = `Your trial ends in ${daysLeft} days — your book disappears with it.`;
    tone = "neutral";
    ctaLabel = "Upgrade Now";
  }

  const toneClasses =
    tone === "red"
      ? "border-[#FF006E]/50 bg-[#FF006E]/10"
      : tone === "amber"
        ? "border-[#FFB020]/40 bg-[#FFB020]/10"
        : "border-white/10 bg-white/5";

  const handleCta = async () => {
    if (!convertNow) {
      router.push("/pricing");
      return;
    }
    setBusy(true);
    const res = await postAuthed("/api/stripe/end-trial-now");
    setBusy(false);
    if (!res.error) onConverted?.();
  };

  return (
    <div className={`mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 ${toneClasses}`}>
      <p className="text-xs text-white/80 sm:text-sm">{message}</p>
      <button
        onClick={handleCta}
        disabled={busy}
        className="shrink-0 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-4 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-60"
      >
        {busy ? "Working..." : ctaLabel}
      </button>
    </div>
  );
}
