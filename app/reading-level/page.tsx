"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { GeneratingOverlay } from "@/components/generating-overlay";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext } from "@/lib/BookwormContext";
import { READING_LEVELS, DEFAULT_READING_LEVEL } from "@/lib/reading-levels";
import { getUserProfile } from "@/lib/firebase/profile";
import { useCourseGeneration } from "@/lib/useCourseGeneration";

/**
 * Change the reading level for the book about to be generated.
 *
 * Most readers no longer land here: the level is chosen once during onboarding
 * and /search generates straight away. This remains for anyone who signed up
 * before onboarding asked for a level, and for the "change level" link on the
 * book confirmation card.
 */
export default function ReadingLevelPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { currentBook } = useBookwormContext();
  const { start, isGenerating, genStep, error } = useCourseGeneration();

  // Never an empty choice: pre-select the reader's saved level, falling back to
  // the middle tier. An unselected three-way pick is a decision to make; a
  // pre-filled one is just something to scan and accept.
  const [selected, setSelected] = useState<string>(DEFAULT_READING_LEVEL);

  // Guard step order: must be signed in (Step 0) and have a confirmed book (Step 1).
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (!currentBook) {
      router.push("/search");
    }
  }, [loading, user, currentBook, router]);

  // Seed from the saved profile once it loads, so returning readers see their
  // own level highlighted rather than the generic default.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserProfile(user.uid)
      .then((profile) => {
        if (cancelled || !profile?.readingLevel) return;
        if (READING_LEVELS.some((l) => l.id === profile.readingLevel)) {
          setSelected(profile.readingLevel);
        }
      })
      .catch((e) => console.error("Could not load reading level:", e));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Avoid a flash before auth/book checks resolve.
  if (loading || !user || !currentBook) return null;

  if (isGenerating) return <GeneratingOverlay step={genStep} />;

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center bg-[#0a0a0a] py-5 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      {/* Header — back arrow returns to the book step */}
      <div className="z-10 mb-4 flex w-full max-w-3xl items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <BackButton to="/search" label="Back to book search" />
          <Logo variant="lockup" size={26} priority className="opacity-90" />
        </div>
      </div>

      {/* Main */}
      <div className="z-10 flex w-full max-w-2xl flex-col items-center px-4">
        {/* Reminder of the book they picked */}
        <div className="mb-3 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 shadow-lg backdrop-blur-sm">
          <span className="text-xs font-semibold text-white/90">📖 {currentBook.title}</span>
        </div>

        <h1 className="mb-1.5 text-center text-2xl font-bold tracking-tight">How do you want to learn?</h1>
        <p className="mb-4 max-w-md text-center text-sm text-white/60">
          Pick the depth that fits you. You can change it anytime.
        </p>

        {/* Level cards */}
        <div className="mb-4 grid w-full grid-cols-1 gap-2.5">
          {READING_LEVELS.map((level) => {
            const isSelected = selected === level.id;
            return (
              <button
                key={level.id}
                type="button"
                onClick={() => setSelected(level.id)}
                aria-pressed={isSelected}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 ${
                  isSelected
                    ? "border-transparent bg-[#1a1a1a] shadow-[0_0_20px_rgba(0,212,255,0.25)] ring-2 ring-[#00D4FF]"
                    : "border-white/10 bg-[#1a1a1a]/50 hover:border-[#FF006E]/60 hover:shadow-[0_0_16px_rgba(255,0,110,0.28)]"
                }`}
              >
                <level.Icon
                  className={`h-8 w-8 shrink-0 ${isSelected ? "text-[#00D4FF]" : "text-white/70"}`}
                  strokeWidth={1.75}
                />
                <div>
                  <h3
                    className={`text-lg font-bold ${
                      isSelected
                        ? "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent"
                        : "text-white"
                    }`}
                  >
                    {level.label}
                  </h3>
                  <p className="text-[13px] leading-snug text-white/70">{level.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-2.5 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <Button
          onClick={() => start(currentBook, selected)}
          className="h-12 w-full max-w-xs rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-12 text-base font-bold text-white shadow-lg shadow-pink-500/20 transition-all duration-300 hover:scale-105"
        >
          Generate My Course →
        </Button>
      </div>
    </div>
  );
}
