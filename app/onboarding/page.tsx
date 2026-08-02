"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { GenreGrid } from "@/components/genre-grid";
import { toggleGenre, GENRE_PICK_COUNT } from "@/lib/genres";
import { updateUserProfile } from "@/lib/firebase/profile";
import { READING_LEVELS, DEFAULT_READING_LEVEL } from "@/lib/reading-levels";

/**
 * First-run onboarding, shown once right after a new account is created (email
 * OR Google). Two steps: favourite genres, then reading level. Both are
 * preferences about the reader rather than about any one book, so they are
 * settled here — that way choosing a first book on /search leads straight into
 * a generated course instead of another form. Existing users never see this;
 * they edit the same settings from Profile.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastBook, setLastBook] = useState("");
  // Pre-selected rather than empty: the reader scans and adjusts instead of
  // being handed a blank three-way decision.
  const [level, setLevel] = useState<string>(DEFAULT_READING_LEVEL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const genresComplete = selected.length === GENRE_PICK_COUNT;

  // Must be signed in to onboard.
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const handleGenresContinue = () => {
    setError(null);
    if (!genresComplete) {
      setError(`Please pick ${GENRE_PICK_COUNT} genres.`);
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    setError(null);
    if (!user) return;

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        genrePreferences: selected,
        lastBookRead: lastBook.trim(),
        readingLevel: level,
      });
      router.push("/search");
    } catch (err) {
      console.error("Failed to save onboarding preferences:", err);
      setError("Something went wrong saving your preferences. Please try again.");
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center bg-[#0a0a0a] py-6 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 mb-6 flex w-full max-w-2xl items-center justify-between px-5">
        <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={110} height={28} priority className="opacity-90" />
        <span className="text-xs font-medium uppercase tracking-widest text-[#00D4FF]">
          Step {step} of 2
        </span>
      </div>

      <div className="z-10 flex w-full max-w-2xl flex-col px-4">
        {step === 1 ? (
          <>
            <h1 className="mb-1.5 text-center text-2xl font-bold tracking-tight md:text-3xl">
              What do you love to read?
            </h1>
            <p className="mb-6 text-center text-sm text-white/60">
              Pick {GENRE_PICK_COUNT} genres so we can recommend books made for you. You can change these anytime.
            </p>

            <GenreGrid selected={selected} onToggle={(g) => setSelected((prev) => toggleGenre(prev, g))} />
            <p className="mt-3 text-center text-xs text-white/40">
              {selected.length}/{GENRE_PICK_COUNT} selected
            </p>

            <div className="mt-6">
              <label htmlFor="lastBook" className="mb-2 block text-sm font-bold text-white/80">
                What&rsquo;s the last book you read? <span className="font-medium text-white/40">(optional)</span>
              </label>
              <input
                type="text"
                id="lastBook"
                value={lastBook}
                onChange={(e) => setLastBook(e.target.value)}
                placeholder="Enter a book title"
                className={`min-h-[48px] w-full rounded-xl border bg-[#1a1a1a] px-4 py-3 text-base text-white placeholder:text-white/40 transition-all focus:border-[#00D4FF] focus:outline-none ${
                  genresComplete && !lastBook.trim()
                    ? "border-[#00D4FF]/60 shadow-[0_0_15px_rgba(0,212,255,0.25)]"
                    : "border-white/15"
                }`}
              />
              {genresComplete && !lastBook.trim() && (
                <p className="mt-1.5 text-xs text-[#00D4FF]">Nice picks! Add a book for sharper recommendations, or continue.</p>
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-[#FF006E]/30 bg-[#FF006E]/10 px-4 py-2.5 text-center text-sm text-[#FF006E]">
                {error}
              </div>
            )}

            <button
              onClick={handleGenresContinue}
              disabled={!genresComplete}
              className={`mt-6 min-h-[48px] w-full rounded-full px-8 text-base font-bold transition-all ${
                !genresComplete
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-[1.02] shadow-lg shadow-pink-500/20"
              }`}
            >
              Continue →
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-1.5 text-center text-2xl font-bold tracking-tight md:text-3xl">
              How do you want to learn?
            </h1>
            <p className="mb-6 text-center text-sm text-white/60">
              This sets the voice every lesson is written in. You can change it anytime.
            </p>

            <div className="grid w-full grid-cols-1 gap-2.5">
              {READING_LEVELS.map((lvl) => {
                const isSelected = level === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setLevel(lvl.id)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300 ${
                      isSelected
                        ? "border-transparent bg-[#1a1a1a] shadow-[0_0_20px_rgba(0,212,255,0.25)] ring-2 ring-[#00D4FF]"
                        : "border-white/10 bg-[#1a1a1a]/50 hover:border-[#FF006E]/60 hover:shadow-[0_0_16px_rgba(255,0,110,0.28)]"
                    }`}
                  >
                    <lvl.Icon
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
                        {lvl.label}
                      </h3>
                      <p className="text-[13px] leading-snug text-white/70">{lvl.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-[#FF006E]/30 bg-[#FF006E]/10 px-4 py-2.5 text-center text-sm text-[#FF006E]">
                {error}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className={`mt-6 min-h-[48px] w-full rounded-full px-8 text-base font-bold transition-all ${
                saving
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-[1.02] shadow-lg shadow-pink-500/20"
              }`}
            >
              {saving ? "Saving…" : "Pick My First Book →"}
            </button>

            <button
              onClick={() => {
                setError(null);
                setStep(1);
              }}
              disabled={saving}
              className="mt-3 text-center text-sm font-semibold text-white/50 transition-colors hover:text-white/80 disabled:opacity-50"
            >
              ← Back to genres
            </button>
          </>
        )}
      </div>
    </div>
  );
}
