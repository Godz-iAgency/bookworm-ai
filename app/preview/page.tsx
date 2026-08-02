"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock } from "lucide-react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { GeneratingOverlay } from "@/components/generating-overlay";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext, type Day } from "@/lib/BookwormContext";
import { generateCourseDays, buildCourse } from "@/lib/generate-course";
import { getStripeClient } from "@/lib/stripe/client";
import { postAuthed } from "@/lib/api-client";
import { READING_LEVELS } from "@/lib/reading-levels";
import { parseLesson } from "@/lib/lesson";
import { GENERATION_STEPS } from "@/lib/useCourseGeneration";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, increment } from "firebase/firestore";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The soft gate — course preview + card collection, per doc4_trial_summary.md.
 * Page Turner trial only (no tier picker): sign up -> search -> reading level
 * land here before their first course generates. Existing subscribers never
 * hit this route (see app/reading-level/page.tsx's access check).
 */
export default function PreviewPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { currentBook, currentReadingLevel, courses, setCourses, setActiveCourseId } = useBookwormContext();

  const [days, setDays] = useState<Day[] | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStep, setGenStep] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (!currentBook) {
      router.push("/search");
    } else if (!currentReadingLevel) {
      router.push("/reading-level");
    }
  }, [loading, user, currentBook, currentReadingLevel, router]);

  useEffect(() => {
    if (!user || !currentBook || !currentReadingLevel) return;
    let cancelled = false;

    // Paced to show real progress rather than one static line that sits
    // still and then jumps straight to the finished course — the actual
    // generation call runs the whole time underneath this, in parallel.
    (async () => {
      const genTask = generateCourseDays(currentBook.title, currentBook.author, currentReadingLevel);

      for (let i = 0; i < GENERATION_STEPS.length - 1; i++) {
        if (cancelled) return;
        setGenStep(i);
        await sleep(1800);
      }
      if (cancelled) return;
      setGenStep(GENERATION_STEPS.length - 1);

      const result = await genTask;
      if (cancelled) return;
      if ("error" in result) {
        setGenError(result.error);
      } else {
        setDays(result.days);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, currentBook, currentReadingLevel]);

  const handleActivated = () => {
    if (!user || !currentBook || !currentReadingLevel || !days) return;
    const newCourse = buildCourse(currentBook, currentReadingLevel, days);
    setCourses([...courses, newCourse]);
    setActiveCourseId(newCourse.id);
    // activate-trial already reset this to 0 server-side; this is the
    // trial's first generated book, counted against the 3-book trial cap.
    updateDoc(doc(db, "users", user.uid), { generationsThisMonth: increment(1) }).catch((e) =>
      console.error("Could not update generation count:", e)
    );
    router.push("/dashboard?trial=started");
  };

  if (loading || !user || !currentBook || !currentReadingLevel) return null;

  const level = READING_LEVELS.find((l) => l.id === currentReadingLevel);
  const stripeConfigured = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (genError) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#0a0a0a] p-6 text-center text-white">
        <p className="mb-4 max-w-sm text-white/70">{genError}</p>
        <Button onClick={() => router.push("/reading-level")} className="rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-8">
          Try Again
        </Button>
      </div>
    );
  }

  if (!days) return <GeneratingOverlay step={genStep} />;

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center bg-[#0a0a0a] py-5 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 mb-4 flex w-full max-w-2xl items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <BackButton to="/reading-level" label="Back to reading level" />
          <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={100} height={26} priority className="opacity-90" />
        </div>
      </div>

      <div className="z-10 flex w-full max-w-2xl flex-col items-center px-4 pb-16">
        {/* Book + level recap */}
        <div className="mb-2 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 shadow-lg backdrop-blur-sm">
          <span className="text-xs font-semibold text-white/90">
            📖 {currentBook.title}
            {level ? ` · ${level.label}` : ""}
          </span>
        </div>

        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">Your 7-Day Course Is Ready</h1>

        {/* Day 1 is free to read, right here, before any card is asked for.
            Its lesson is already written by this point (the outline call
            produces it), so locking it gained nothing and made the reader
            judge the course sight-unseen. */}
        <div className="mb-5 w-full rounded-xl border border-[#00D4FF]/40 bg-[#00D4FF]/[0.06] px-4 py-4 shadow-[0_0_20px_rgba(0,212,255,0.12)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#00D4FF]">Day 1</p>
              <p className="text-sm font-medium text-white/90">{days[0]?.title}</p>
            </div>
            <span className="shrink-0 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#00D4FF]">
              Free to read
            </span>
          </div>

          {days[0]?.lesson ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-sm font-bold text-[#00D4FF] transition-opacity hover:opacity-80">
                <span className="group-open:hidden">Read Day 1 now →</span>
                <span className="hidden group-open:inline">Hide Day 1</span>
              </summary>
              <div className="mt-3 max-h-[45vh] overflow-y-auto border-t border-white/10 pt-3">
                <LessonPreview lesson={days[0].lesson} />
              </div>
            </details>
          ) : (
            <p className="text-sm text-white/60">{days[0]?.previewText}</p>
          )}
        </div>

        {/* The ask sits right under the value it's asking about — not after a
            wall of locked rows and fine print. That list moves below, for
            anyone who wants more convincing before deciding; it's no longer
            what stands between "I liked Day 1" and being able to act on it. */}
        <div className="mb-6 w-full rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/[0.05] px-4 py-4">
          <p className="mb-3 text-center text-sm font-bold text-white">
            Day 1 was free. Your card unlocks Days 2 to 7.
          </p>

          {stripeConfigured ? (
            <Elements stripe={getStripeClient()}>
              <SoftGateForm onActivated={handleActivated} />
            </Elements>
          ) : (
            // No publishable key yet — say so plainly instead of rendering an
            // empty card box that looks broken.
            <div className="w-full rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-3 text-center text-sm text-[#FFB020]">
              Card payments aren&apos;t set up yet. Add your Stripe keys to
              <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5 text-xs">.env.local</code>
              to enable the free trial.
            </div>
          )}
        </div>

        <div className="mb-4 h-px w-full bg-white/10" />

        {/* Supporting detail: the rest of the arc, plus the guarantees. Below
            the ask now, not blocking it. */}
        <div className="mb-6 w-full space-y-2">
          {days.slice(1).map((day) => (
            <div
              key={day.dayNumber}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#1a1a1a]/60 px-3 py-2"
            >
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/40">
                Day {day.dayNumber}
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] text-white/70">{day.title}</p>
              <Lock className="h-3.5 w-3.5 shrink-0 text-white/25" strokeWidth={2} />
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 text-sm text-white/60">
            <span>+ AI Chat — Ask the book anything</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>+ 20 Smart Flashcards — generated from the book</span>
          </div>
        </div>

        <div className="mb-4 w-full space-y-2.5">
          {[
            "A reminder email goes to your inbox before your trial ends so nothing catches you off guard.",
            "Cancel in one tap — no forms, no phone calls, no runaround.",
            "Your book disappears in 7 days either way. That is kind of the whole point.",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2 text-sm text-white/80">
              <span className="mt-0.5 text-[#00D4FF]">✓</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Day 1's lesson, rendered with the same parser and reading serif the real
 * reader uses, so the free sample looks like the product rather than a teaser.
 */
function LessonPreview({ lesson }: { lesson: string }) {
  return (
    <article className="font-reading">
      {parseLesson(lesson).map((b, i) =>
        b.type === "heading" ? (
          <h4 key={i} className="mb-1.5 mt-4 text-[15px] font-bold text-white first:mt-0">
            {b.text}
          </h4>
        ) : (
          <p key={i} className="mb-3 text-[14px] leading-7 text-white/80">
            {b.text}
          </p>
        )
      )}
    </article>
  );
}

function SoftGateForm({ onActivated }: { onActivated: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
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

      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(setupRes.clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) {
        setError(stripeError.message || "Card could not be saved.");
        return;
      }

      const paymentMethodId =
        typeof setupIntent?.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id;

      const activateRes = await postAuthed("/api/stripe/activate-trial", { paymentMethodId });

      if (activateRes.error) {
        setError(activateRes.error);
        return;
      }

      onActivated();
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-4">
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
        disabled={loading || !stripe}
        className="mt-4 h-12 w-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-base font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
      >
        {loading ? "Setting up your experience..." : "Start My Free Experience →"}
      </Button>

      <p className="mt-3 text-center text-xs text-white/40">
        No charge today. Cancel before Day 7 and you pay nothing, ever.
      </p>
    </div>
  );
}
