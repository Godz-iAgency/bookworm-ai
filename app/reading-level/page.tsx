"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext, Course, Day } from "@/lib/BookwormContext";
import { READING_LEVELS } from "@/lib/reading-levels";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

const GENERATION_STEPS = [
  "Reading the book's core ideas...",
  "Breaking it into 7 concepts...",
  "Writing your daily lessons...",
  "Building your flashcards...",
  "Almost ready...",
];

export default function ReadingLevelPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { currentBook, setCurrentReadingLevel, courses, setCourses, setActiveCourseId } = useBookwormContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);

  // Guard step order: must be signed in (Step 0) and have a confirmed book (Step 1).
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (!currentBook) {
      router.push("/search");
    }
  }, [loading, user, currentBook, router]);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleContinue = async () => {
    if (!selected || !user || !currentBook) return;
    setError(null);
    setIsGenerating(true);
    setGenStep(0);

    // Save the chosen level to the user's profile (don't block generation on it).
    updateDoc(doc(db, "users", user.uid), { readingLevel: selected }).catch((e) =>
      console.error("Could not save reading level:", e)
    );
    setCurrentReadingLevel(selected);

    // Kick off the real generation and the step animation in parallel.
    const genTask = fetch("/api/course/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: currentBook.title,
        author: currentBook.author,
        readingLevel: selected,
      }),
    })
      .then((res) => res.json())
      .catch((e) => ({ error: e.message }));

    // Cycle the status messages while we wait (each step shows briefly).
    for (let i = 0; i < GENERATION_STEPS.length - 1; i++) {
      setGenStep(i);
      await sleep(1800);
    }
    setGenStep(GENERATION_STEPS.length - 1);

    const data = await genTask;

    if (!data || data.error || !Array.isArray(data.days) || data.days.length === 0) {
      console.error("Generation error:", data?.error);
      setError(
        "We couldn't build your course right now. Please try again in a moment."
      );
      setIsGenerating(false);
      return;
    }

    const days: Day[] = data.days.slice(0, 7).map((d: any, i: number) => ({
      dayNumber: d.dayNumber ?? i + 1,
      title: d.title ?? `Day ${i + 1}`,
      previewText: d.previewText ?? "",
      lesson: d.lesson ?? "",
      flashcards: Array.isArray(d.flashcards) ? d.flashcards.slice(0, 3) : [],
      chatSeed: Array.isArray(d.chatSeed) ? d.chatSeed.slice(0, 3) : [],
      isUnlocked: i === 0,
      isCompleted: false,
    }));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 8);
    const newCourse: Course = {
      id: Math.random().toString(36).slice(2, 11),
      book: currentBook,
      readingLevel: selected,
      status: "active",
      days,
      expiresAt: expiresAt.toISOString(),
    };
    setCourses([...courses, newCourse]);
    setActiveCourseId(newCourse.id);

    router.push("/dashboard");
  };

  // Avoid a flash before auth/book checks resolve.
  if (loading || !user || !currentBook) return null;

  // Full-screen generation animation.
  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen w-full flex-col items-center justify-center bg-[#0a0a0a] p-6 text-white">
        <style>{`@keyframes slide-gradient { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`}</style>
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={220} height={56} priority className="mb-14 drop-shadow-2xl" />
          <div className="mb-8 h-3 w-full overflow-hidden rounded-full border border-white/5 bg-[#1a1a1a] shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] via-[#FF006E] to-[#00D4FF]"
              style={{
                backgroundSize: "200% auto",
                animation: "slide-gradient 2s linear infinite",
                width: `${((genStep + 1) / GENERATION_STEPS.length) * 100}%`,
                transition: "width 1.5s linear",
              }}
            />
          </div>
          <h2 className="h-10 animate-pulse bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-xl font-bold text-transparent md:text-2xl">
            {GENERATION_STEPS[genStep]}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-[#0a0a0a] py-5 text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/60" />

      {/* Header — back arrow returns to the book step */}
      <div className="z-10 mb-4 flex w-full max-w-3xl items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <BackButton to="/search" label="Back to book search" />
          <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={100} height={26} priority className="opacity-90" />
        </div>
        <span className="text-xs font-medium uppercase tracking-widest text-[#00D4FF]">Step 2 of 2</span>
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
                    : "border-white/10 bg-[#1a1a1a]/50 hover:border-white/30"
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
          onClick={handleContinue}
          disabled={!selected}
          className={`h-12 w-full max-w-xs rounded-full px-12 text-base font-bold transition-all duration-300 ${
            selected
              ? "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-105 shadow-lg shadow-pink-500/20"
              : "cursor-not-allowed bg-white/10 text-white/40"
          }`}
        >
          Generate My Course →
        </Button>
      </div>
    </div>
  );
}
