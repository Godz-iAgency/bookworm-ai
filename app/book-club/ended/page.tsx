"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2, Users, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { getStripeClient } from "@/lib/stripe/client";
import { getBillingProfile, needsBookClubConversion, type BillingProfile } from "@/lib/billing";
import { PLANS, planFromId } from "@/lib/plans";
import { daysUntil, CONVERSION_WINDOW_DAYS } from "@/lib/book-club";

type Choice = "trial" | "page_turner" | "well_read";

/**
 * Where a reader lands after a Book Club owner removes them.
 *
 * The honest version of this screen is not a paywall. Their account, their
 * books and their streak are all still here; what has gone is the
 * subscription someone else was paying for. So it says plainly what happened,
 * how long they have, and what the ways forward are — including deleting
 * everything now, which belongs here as much as the paid options do.
 *
 * The trial is offered only to someone who has never had one. Everyone who
 * joins a club this way arrives without one, but a reader who trialled
 * Bookworm on their own months ago and later joined a friend's club has, and
 * quietly handing them a second one would make the first one a lie.
 */
export default function BookClubEndedPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [billing, setBilling] = useState<BillingProfile | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const profile = await getBillingProfile(user.uid);
    setBilling(profile);
    // Nothing to decide: they still have access, either because they never
    // lost it or because they just chose a plan. Never strand someone on a
    // screen whose whole premise has stopped being true.
    if (profile && !needsBookClubConversion(profile)) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void refresh();
  }, [loading, user, router, refresh]);

  const trialEligible = !!billing && !billing.trialStartedAt && !billing.trialStatus;
  const hasSavedCard = !!billing?.stripePaymentMethodId;
  const stripeConfigured = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  /** Finish a choice once a card is on file (saved earlier, or just entered). */
  const applyChoice = useCallback(
    async (selected: Choice, paymentMethodId?: string): Promise<string | null> => {
      if (selected === "trial") {
        const res = await postAuthed("/api/stripe/activate-trial", {
          paymentMethodId: paymentMethodId ?? billing?.stripePaymentMethodId,
        });
        return res.error ?? null;
      }
      // A card entered here is only saved, never charged, until the plan
      // itself is started — /api/stripe/upgrade is what actually bills.
      if (paymentMethodId) {
        const attach = await postAuthed("/api/stripe/attach-card", { paymentMethodId });
        if (attach.error) return attach.error;
      }
      const res = await postAuthed("/api/stripe/upgrade", { targetPlan: selected });
      return res.error ?? null;
    },
    [billing],
  );

  const chooseWithSavedCard = async (selected: Choice) => {
    setBusy(true);
    setError(null);
    const failure = await applyChoice(selected);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    router.replace("/dashboard");
  };

  const handleDeleteNow = async () => {
    setBusy(true);
    setError(null);
    const res = await postAuthed("/api/account/delete");
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.replace("/");
  };

  if (loading || !user || !billing) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  const daysLeft = billing.bookClubDeleteAt
    ? daysUntil(billing.bookClubDeleteAt)
    : CONVERSION_WINDOW_DAYS;

  const options: { id: Choice; name: string; price: string; blurb: string }[] = [
    ...(trialEligible
      ? [
          {
            id: "trial" as const,
            name: "Start your free trial",
            price: "Free for 7 days",
            blurb: "1 book to try it. No charge today, cancel any time before day 7.",
          },
        ]
      : []),
    ...PLANS.filter((p) => p.id === "page_turner" || p.id === "well_read").map((p) => ({
      id: p.id as Choice,
      name: p.name,
      price: `${p.price}/month`,
      blurb: `${p.monthlyGenerations} books a month, up to ${p.maxOpenBooks} open at a time.`,
    })),
  ];

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center bg-[#0a0a0a] py-6 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 flex w-full max-w-lg flex-col items-center px-5 pb-16">
        <Logo variant="stacked" priority className="mb-6 w-32 opacity-90" />

        <Users className="mb-3 h-9 w-9 text-[#00D4FF]" strokeWidth={1.75} />
        <h1 className="text-center text-2xl font-bold tracking-tight">
          Your Book Club access has ended
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/70">
          You have{" "}
          <span className="font-bold text-white">
            {daysLeft} {daysLeft === 1 ? "day" : "days"}
          </span>{" "}
          to continue with Bookworm before your account and remaining data are deleted.
        </p>

        {error && (
          <div className="mt-5 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-6 w-full space-y-3">
          {options.map((option) => {
            const selected = choice === option.id;
            return (
              <div
                key={option.id}
                className={`rounded-2xl border p-4 transition-all ${
                  selected
                    ? "border-transparent bg-[#141414] ring-2 ring-[#00D4FF]"
                    : "border-white/10 bg-[#111] hover:border-white/25"
                }`}
              >
                <button
                  onClick={() => {
                    setError(null);
                    setChoice(selected ? null : option.id);
                  }}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-[#00D4FF] bg-[#00D4FF]" : "border-white/30"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3 text-black" strokeWidth={3.5} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold">{option.name}</p>
                      <p className="shrink-0 text-xs font-bold text-[#00D4FF]">{option.price}</p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">{option.blurb}</p>
                  </div>
                </button>

                {selected && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    {hasSavedCard ? (
                      <Button
                        onClick={() => chooseWithSavedCard(option.id)}
                        disabled={busy}
                        className="h-11 w-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
                      >
                        {busy
                          ? "Working…"
                          : option.id === "trial"
                            ? "Start my free trial"
                            : `Continue on ${planFromId(option.id).name}`}
                      </Button>
                    ) : stripeConfigured ? (
                      <Elements stripe={getStripeClient()}>
                        <CardStep
                          label={
                            option.id === "trial"
                              ? "Start my free trial"
                              : `Continue on ${planFromId(option.id).name}`
                          }
                          note={
                            option.id === "trial"
                              ? "No charge today. Cancel before day 7 and you pay nothing."
                              : `Your card is charged ${planFromId(option.id).price} today.`
                          }
                          onSubmit={(paymentMethodId) => applyChoice(option.id, paymentMethodId)}
                          onDone={() => router.replace("/dashboard")}
                        />
                      </Elements>
                    ) : (
                      <div className="rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-3 text-center text-sm text-[#FFB020]">
                        Card payments aren&apos;t set up on this deployment yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Deleting now is a real choice, not a punishment — quiet, but not
            hidden, and never a single tap. */}
        <div className="mt-8 w-full border-t border-white/10 pt-5 text-center">
          {confirmDelete ? (
            <div className="rounded-xl border border-[#FF006E]/40 bg-[#FF006E]/10 p-4">
              <p className="text-[13px] leading-relaxed text-white/85">
                This deletes your account, your books and your sign-in right now. It can&rsquo;t be
                undone.
              </p>
              <div className="mt-3 flex gap-2.5">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/80 disabled:opacity-60"
                >
                  Never mind
                </button>
                <button
                  onClick={handleDeleteNow}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-[#FF006E] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? "Deleting…" : "Delete now"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-semibold text-white/40 transition-colors hover:text-white/70"
            >
              Delete my account now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Card entry for readers who have never given us one — which is everyone who
 * only ever read on someone else's Book Club subscription.
 */
function CardStep({
  label,
  note,
  onSubmit,
  onDone,
}: {
  label: string;
  note: string;
  onSubmit: (paymentMethodId: string) => Promise<string | null>;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    try {
      const setupRes = await postAuthed("/api/stripe/create-setup-intent");
      if (setupRes.error || !setupRes.clientSecret) {
        setError(setupRes.error || "Could not start card setup.");
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError("Card form isn't ready yet — try again in a moment.");
        return;
      }

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        setupRes.clientSecret,
        { payment_method: { card: cardElement } },
      );
      if (stripeError) {
        setError(stripeError.message || "Card could not be saved.");
        return;
      }

      const paymentMethodId =
        typeof setupIntent?.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id;
      if (!paymentMethodId) {
        setError("Card could not be saved.");
        return;
      }

      const failure = await onSubmit(paymentMethodId);
      if (failure) {
        setError(failure);
        return;
      }
      onDone();
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3.5">
        <CardElement
          options={{
            style: {
              base: {
                color: "#ffffff",
                fontSize: "16px",
                iconColor: "#00D4FF",
                "::placeholder": { color: "#888888" },
              },
              invalid: { color: "#FF6B6B" },
            },
          }}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={busy || !stripe}
        className="mt-3 h-11 w-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {busy ? "Working…" : label}
      </Button>
      <p className="mt-2 text-center text-[11px] text-white/40">{note}</p>
    </div>
  );
}
