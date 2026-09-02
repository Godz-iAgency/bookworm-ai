"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Check, Loader2, Copy } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { PLANS, planFromId, type Plan } from "@/lib/plans";
import { getBillingProfile, getEffectivePlanId, type BillingProfile } from "@/lib/billing";

/**
 * A smaller, truer way to read the same price. A monthly figure in isolation
 * is judged against other monthly bills; the same number per day, or split
 * across a Book Club's members, is judged against pocket change. Derived from
 * the plan data so it can never drift from the price beside it.
 */
function priceAnchor(plan: Plan): string | null {
  const monthly = Number(plan.price.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(monthly) || monthly <= 0) return null;

  if (plan.maxMembers && plan.maxMembers > 1) {
    return `About $${(monthly / plan.maxMembers).toFixed(2)} per person`;
  }
  return `About $${(monthly / 30).toFixed(2)} a day`;
}

/** What /api/stripe/preview-upgrade reports a tier change would cost. */
interface UpgradeQuote {
  mode: "charge_now" | "next_invoice";
  amount: number; // in the currency's smallest unit (cents)
  currency: string;
  endsTrial?: boolean;
  nextInvoiceAt?: string | null;
}

function formatMoney(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format(amountInCents / 100);
}

function planPerks(plan: Plan): string[] {
  // Book Club's generation cap is per member, not shared - each of up to 4
  // people gets their own monthlyGenerations allowance against their own
  // account (see canGenerate in lib/billing.ts). Leading with that per-person
  // number made Book Club's headline figure look SMALLER than Well-Read's
  // (10 next to 25) when the group's real capacity is actually the biggest of
  // the three. The lead number is the group's total; the split is spelled out
  // separately so "10 books each" isn't lost.
  const total = plan.maxMembers ? plan.monthlyGenerations * plan.maxMembers : plan.monthlyGenerations;
  const perks = [
    `${total} books a month${plan.maxMembers ? " across your group" : ""}`,
    `Up to ${plan.maxOpenBooks} open at a time`,
    "AI chat + smart flashcards on every book",
  ];
  if (plan.maxMembers) {
    perks.push(`Split with ${plan.maxMembers - 1} others, ${plan.monthlyGenerations} books each`);
  }
  return perks;
}

export default function PricingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [billing, setBilling] = useState<BillingProfile | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<{ planId: Plan["id"]; quote: UpgradeQuote } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const reduceMotion = useReducedMotion();

  // The dialog is a bottom sheet on a phone and a centred card above it (the
  // layout switches at sm:), so its entrance has to match wherever it actually
  // sits: rising from the bottom edge on a phone, scaling up in place on a
  // desktop. `exit` reuses `initial`, which is what keeps the two symmetric.
  const isSheet = typeof window !== "undefined" && window.innerWidth < 640;
  const sheetMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : isSheet
      ? { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } }
      : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 } };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    getBillingProfile(user.uid)
      .then(setBilling)
      .catch((e) => console.error("Failed to load billing:", e));
  }, [loading, user, router]);

  const currentPlan = billing ? getEffectivePlanId(billing) : "free";

  // Changing tiers moves real money, so it never happens on a single tap.
  // Ask Stripe what it would actually cost, show that exact figure, and only
  // switch once the reader has agreed to it.
  const handleChoose = async (planId: Plan["id"]) => {
    setBusyPlan(planId);
    setError(null);
    const res = await postAuthed("/api/stripe/preview-upgrade", { targetPlan: planId });
    setBusyPlan(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setPending({ planId, quote: res });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setConfirming(true);
    setError(null);
    const res = await postAuthed("/api/stripe/upgrade", { targetPlan: pending.planId });
    setConfirming(false);
    setPending(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (user) setBilling(await getBillingProfile(user.uid));
  };

  const handleInvite = async () => {
    setError(null);
    const res = await postAuthed("/api/family/invite");
    if (res.error) {
      setError(res.error);
      return;
    }
    setInviteCode(res.code);
  };

  const inviteLink = inviteCode ? `${window.location.origin}/join/${inviteCode}` : null;

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is visible on screen to copy manually */
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center bg-[#0a0a0a] py-5 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 mb-4 flex w-full max-w-3xl items-center gap-2 px-5">
        <BackButton to="/dashboard" label="Back to your shelf" />
        <Logo variant="lockup" size={26} priority className="opacity-90" />
      </div>

      <div className="z-10 flex w-full max-w-3xl flex-col items-center px-4 pb-16">
        <h1 className="mb-1.5 text-center text-2xl font-bold tracking-tight">Choose how you read</h1>
        <p className="mb-6 max-w-md text-center text-sm text-white/60">
          Every book still disappears in 7 days. That is kind of the whole point.
        </p>

        {error && (
          <div className="mb-4 w-full max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid w-full gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border p-5 transition-all ${
                  isCurrent
                    ? "border-transparent bg-[#1a1a1a] shadow-[0_0_20px_rgba(0,212,255,0.25)] ring-2 ring-[#00D4FF]"
                    : "border-white/10 bg-[#1a1a1a]/50 hover:border-[#FF006E]/50"
                }`}
              >
                {/* The plan name is the first thing a scanning eye needs to
                    resolve - "which card am I looking at" - so it has to win
                    against the price's own text-3xl font-black, not sit
                    beneath it. Previously text-lg font-bold read as a caption
                    above the real heading (the price) rather than as the
                    card's actual title. */}
                <h2 className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-2xl font-black tracking-tight text-transparent">
                  {plan.name}
                </h2>
                <p className="mb-3 text-[13px] leading-snug text-white/60">{plan.tagline}</p>
                <p className="text-3xl font-black">
                  {plan.price}
                  <span className="text-sm font-medium text-white/50">/month</span>
                </p>
                {priceAnchor(plan) && (
                  <p className="mb-4 mt-0.5 text-xs font-semibold text-[#00D4FF]">{priceAnchor(plan)}</p>
                )}

                <ul className="mb-5 flex-1 space-y-2">
                  {planPerks(plan).map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-[13px] text-white/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00D4FF]" strokeWidth={2.5} />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleChoose(plan.id)}
                  disabled={isCurrent || busyPlan !== null}
                  className={`h-11 w-full rounded-full text-sm font-bold transition-all ${
                    isCurrent
                      ? "cursor-default bg-white/10 text-white/50"
                      : "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-105"
                  }`}
                >
                  {isCurrent ? "Your plan" : busyPlan === plan.id ? "Checking price..." : "Choose"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Confirmation — never switch tiers on a single tap. States the real
            figure Stripe gave us and whether it lands today or next cycle. */}
        <AnimatePresence>
          {pending && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="switch-plan-title"
              onClick={() => !confirming && setPending(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Leaves the way it arrived: down and out on a phone, back into
                  its own centre on a desktop. Previously this slid up on open
                  and then simply vanished on dismiss, which read as a glitch
                  rather than a dialog closing. */}
              <motion.div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl"
                initial={sheetMotion.initial}
                animate={sheetMotion.animate}
                exit={sheetMotion.initial}
                transition={
                  reduceMotion
                    ? { duration: 0.2 }
                    : { type: "spring", bounce: 0.2, duration: 0.4 }
                }
              >
              <h3 id="switch-plan-title" className="mb-1 text-lg font-bold">
                Switch to {planFromId(pending.planId).name}?
              </h3>

              {pending.quote.mode === "charge_now" ? (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-white/70">
                    {pending.quote.endsTrial
                      ? "This ends your free trial straight away and starts your plan today."
                      : "This starts your plan today."}
                  </p>
                  <div className="mb-4 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/[0.07] px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Charged today</p>
                    <p className="text-2xl font-black text-white">
                      {formatMoney(pending.quote.amount, pending.quote.currency)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm leading-relaxed text-white/70">
                    Your new plan starts right away. Nothing is charged today, the difference is
                    added to your next invoice.
                  </p>
                  <div className="mb-4 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/[0.07] px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                      Your next invoice
                      {pending.quote.nextInvoiceAt
                        ? ` · ${new Date(pending.quote.nextInvoiceAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}`
                        : ""}
                    </p>
                    <p className="text-2xl font-black text-white">
                      {formatMoney(pending.quote.amount, pending.quote.currency)}
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2.5">
                <button
                  onClick={() => setPending(null)}
                  disabled={confirming}
                  className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-4 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                >
                  {confirming ? "Switching..." : "Confirm switch"}
                </button>
              </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Book Club owners manage their members here. */}
        {billing?.isFamilyOwner && (
          <div className="mt-8 w-full rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-5">
            <h3 className="mb-1 text-base font-bold">Your Book Club</h3>
            <p className="mb-4 text-[13px] text-white/60">
              Invite up to 3 others. Each gets their own books, and your card covers everyone.
            </p>

            {inviteLink ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80">
                  {inviteLink}
                </code>
                <button
                  onClick={copyInvite}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <Button
                onClick={handleInvite}
                className="h-11 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-6 text-sm font-bold text-white hover:scale-105"
              >
                Create an invite link
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
