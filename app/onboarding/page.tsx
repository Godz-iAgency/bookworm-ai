"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { useAuth } from "@/context/AuthContext";
import { GenreGrid } from "@/components/genre-grid";
import { toggleGenre, GENRE_PICK_COUNT } from "@/lib/genres";
import { updateUserProfile } from "@/lib/firebase/profile";
import { READING_LEVELS, DEFAULT_READING_LEVEL } from "@/lib/reading-levels";
import { LANGUAGES, DEFAULT_LANGUAGE } from "@/lib/languages";
import { destinationAfterOnboarding } from "@/lib/pending-invite";
import { useBackStep } from "@/lib/useBackStep";
import { ReadingDisplayPicker } from "@/components/reading-display-picker";
import { DEFAULT_FONT_SIZE, DEFAULT_READING_MODE, type ReadingFontSize, type ReadingMode } from "@/lib/reading-prefs";

/**
 * First-run onboarding, shown once right after a new account is created (email
 * OR Google). Two steps: topics to grow in, then reading level, the language
 * lessons are written in, and how they look (text size, scroll or pages), so
 * the free Day 1 already reads the way they chose. All of these are
 * preferences about the reader rather than about any one book, so they are
 * settled here - that way choosing a first book on /search leads straight into
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
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [fontSize, setFontSize] = useState<ReadingFontSize>(DEFAULT_FONT_SIZE);
  const [readingMode, setReadingMode] = useState<ReadingMode>(DEFAULT_READING_MODE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const genresComplete = selected.length === GENRE_PICK_COUNT;

  const backToTopics = () => {
    setError(null);
    setStep(1);
  };
  // The phone's own back button goes from step 2 to step 1 too.
  useBackStep(step === 2, backToTopics);

  // Must be signed in to onboard.
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const handleGenresContinue = () => {
    setError(null);
    if (!genresComplete) {
      setError(`Please pick ${GENRE_PICK_COUNT} topics.`);
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
        preferredLanguage: language,
        readingFontSize: fontSize,
        readingMode,
      });
      // The reader opens at these straight away, before the profile is read back.
      try {
        localStorage.setItem(`bookworm_reading_prefs_${user.uid}`, JSON.stringify({ fontSize, readingMode }));
      } catch {
        // Storage blocked: the profile copy above is what counts.
      }
      // Normally straight to picking a first book, but someone who arrived
      // here from a Book Club invite goes back to finish joining it first -
      // now that they have the reading level a course actually needs.
      // replace, not push: back from the first book should not land on onboarding again.
      router.replace(destinationAfterOnboarding());
    } catch (err) {
      console.error("Failed to save onboarding preferences:", err);
      setError("Something went wrong saving your preferences. Please try again.");
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  return (
    // overflow-y-auto explicitly, not left to default: this page's height
    // sits right at the edge of a phone screen (a Galaxy S20 clipped the
    // Continue button by only ~4px), and the fix is to fit within one
    // screen rather than lean on a scroll gesture that may not even be
    // needed once things are tightened up.
    <div className="relative flex min-h-dvh w-full flex-col items-center overflow-y-auto bg-[#0a0a0a] py-3 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 mb-3 flex w-full max-w-3xl items-center justify-between px-3">
        <div className="flex items-center gap-2">
          {step === 2 && (
            <button
              type="button"
              onClick={backToTopics}
              disabled={saving}
              aria-label="Back to topics"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors before:absolute before:-bottom-3 before:-left-4 before:-right-2 before:-top-3 before:content-[''] hover:bg-white/10 hover:text-white active:bg-white/15 disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          <Logo variant="lockup" size={26} priority className="opacity-90" />
        </div>
        <span className="text-xs font-medium uppercase tracking-widest text-[#00D4FF]">
          Step {step} of 2
        </span>
      </div>

      <div className="z-10 flex w-full max-w-3xl flex-col px-3">
        {step === 1 ? (
          <>
            <h1 className="mb-1 text-center text-xl font-bold tracking-tight md:text-3xl">
              What do you want to get better at?
            </h1>
            <p className="mb-3 text-center text-sm text-white/60">
              Pick {GENRE_PICK_COUNT} topics so we can recommend books made for you. You can change these anytime.
            </p>

            <GenreGrid selected={selected} onToggle={(g) => setSelected((prev) => toggleGenre(prev, g))} />
            <p className="mt-2 text-center text-xs text-white/40">
              {selected.length}/{GENRE_PICK_COUNT} selected
            </p>

            <div className="mt-4">
              <label htmlFor="lastBook" className="mb-1.5 block text-sm font-bold text-white/80">
                What&rsquo;s the last book you read? <span className="font-medium text-white/40">(optional)</span>
              </label>
              <input
                type="text"
                id="lastBook"
                value={lastBook}
                onChange={(e) => setLastBook(e.target.value)}
                placeholder="Enter a book title"
                className={`min-h-[44px] w-full rounded-xl border bg-[#1a1a1a] px-4 py-2.5 text-base text-white placeholder:text-white/40 transition-all focus:border-[#00D4FF] focus:outline-none ${
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
              <div className="mt-3 rounded-lg border border-[#FF006E]/30 bg-[#FF006E]/10 px-4 py-2.5 text-center text-sm text-[#FF006E]">
                {error}
              </div>
            )}

            <button
              onClick={handleGenresContinue}
              disabled={!genresComplete}
              className={`mt-4 min-h-[44px] w-full rounded-full px-8 text-base font-bold transition-all ${
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
              Choose how every lesson is written and how it looks. You can change all of this anytime in Profile.
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
                      <p className="text-[0.8125rem] leading-snug text-white/70">{lvl.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <h2 className="mb-2 mt-6 text-center text-base font-bold">Lessons written in</h2>
            <div className="grid w-full grid-cols-3 gap-2.5" role="radiogroup" aria-label="Language of your lessons">
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setLanguage(lang.id)}
                    className={`rounded-2xl border px-2 py-3 text-center transition-all duration-300 ${
                      isSelected
                        ? "border-transparent bg-[#1a1a1a] shadow-[0_0_20px_rgba(0,212,255,0.25)] ring-2 ring-[#00D4FF]"
                        : "border-white/10 bg-[#1a1a1a]/50 hover:border-[#FF006E]/60"
                    }`}
                  >
                    <span className={`block text-base font-bold ${isSelected ? "text-[#00D4FF]" : "text-white"}`}>{lang.native}</span>
                    {lang.native !== lang.label && <span className="block text-xs text-white/50">{lang.label}</span>}
                  </button>
                );
              })}
            </div>

            <h2 className="mb-2 mt-6 text-center text-base font-bold">How your lessons look</h2>
            <div className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a]/50 p-3.5">
              <ReadingDisplayPicker
                fontSize={fontSize}
                readingMode={readingMode}
                onFontSize={setFontSize}
                onReadingMode={setReadingMode}
              />
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
              onClick={backToTopics}
              disabled={saving}
              className="mt-3 text-center text-sm font-semibold text-white/50 transition-colors hover:text-white/80 disabled:opacity-50"
            >
              ← Back to topics
            </button>
          </>
        )}
      </div>
    </div>
  );
}
