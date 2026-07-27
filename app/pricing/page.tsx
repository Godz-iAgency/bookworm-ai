"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { PLANS, type Plan } from "@/lib/plans";
import { getBillingProfile, getEffectivePlanId, type BillingProfile } from "@/lib/billing";

function planPerks(plan: Plan): string[] {
  const perks = [
    `${plan.monthlyGenerations} books a month`,
    `Up to ${plan.maxOpenBooks} open at a time`,
    "AI chat + smart flashcards on every book",
  ];
  if (plan.maxMembers) {
    perks.push(`Share with ${plan.maxMembers - 1} others — each with their own books`);
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

  const handleChoose = async (planId: Plan["id"]) => {
    setBusyPlan(planId);
    setError(null);
    const res = await postAuthed("/api/stripe/upgrade", { targetPlan: planId });
    setBusyPlan(null);
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
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-[#0a0a0a] py-5 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 mb-4 flex w-full max-w-3xl items-center gap-2 px-5">
        <BackButton to="/dashboard" label="Back to your shelf" />
        <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={100} height={26} priority className="opacity-90" />
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
                <h2 className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-lg font-bold text-transparent">
                  {plan.name}
                </h2>
                <p className="mb-3 text-[13px] leading-snug text-white/60">{plan.tagline}</p>
                <p className="mb-4 text-3xl font-black">
                  {plan.price}
                  <span className="text-sm font-medium text-white/50">/month</span>
                </p>

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
                  {isCurrent ? "Your plan" : busyPlan === plan.id ? "Switching..." : "Choose"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Book Club owners manage their members here. */}
        {billing?.isFamilyOwner && (
          <div className="mt-8 w-full rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-5">
            <h3 className="mb-1 text-base font-bold">Your Book Club</h3>
            <p className="mb-4 text-[13px] text-white/60">
              Invite up to 3 others. Each gets their own books — your card covers everyone.
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
