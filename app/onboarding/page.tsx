"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { GenreGrid } from "@/components/genre-grid";
import { toggleGenre, GENRE_PICK_COUNT } from "@/lib/genres";
import { updateUserProfile } from "@/lib/firebase/profile";

/**
 * First-run onboarding, shown once right after a new account is created (email
 * OR Google). Collects the reader's favorite genres + last book read, which
 * personalize book recommendations on /search. Existing users never see this —
 * they edit these preferences from Profile instead.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [lastBook, setLastBook] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const genresComplete = selected.length === GENRE_PICK_COUNT;

  // Must be signed in to onboard.
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const handleContinue = async () => {
    setError(null);
    if (selected.length !== GENRE_PICK_COUNT) {
      setError(`Please pick ${GENRE_PICK_COUNT} genres.`);
      return;
    }
    // Last book is optional — genres alone are enough to continue.
    if (!user) return;

    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        genrePreferences: selected,
        lastBookRead: lastBook.trim(),
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
    <div className="relative flex min-h-screen w-full flex-col items-center bg-[#0a0a0a] py-6 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      <div className="z-10 mb-6 flex w-full max-w-2xl items-center justify-between px-5">
        <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={110} height={28} priority className="opacity-90" />
        <span className="text-xs font-medium uppercase tracking-widest text-[#00D4FF]">Welcome</span>
      </div>

      <div className="z-10 flex w-full max-w-2xl flex-col px-4">
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
          onClick={handleContinue}
          disabled={saving || !genresComplete}
          className={`mt-6 min-h-[48px] w-full rounded-full px-8 text-base font-bold transition-all ${
            saving || !genresComplete
              ? "cursor-not-allowed bg-white/10 text-white/40"
              : "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-[1.02] shadow-lg shadow-pink-500/20"
          }`}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  );
}
