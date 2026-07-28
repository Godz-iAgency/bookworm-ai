"use client";

import { useState, useEffect } from "react";
import { Course, Day } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import type { DayContentStatus } from "@/lib/useDayContent";

export default function FlashcardTab({
  course,
  day,
  contentStatus = "ready",
  onRetryContent,
}: {
  course: Course;
  day: Day;
  /** Generation state for this day, owned by the dashboard (useDayContent). */
  contentStatus?: DayContentStatus;
  onRetryContent?: () => void;
}) {
  // Cards come straight from the day's AI-generated content (3 per day), tuned
  // to that lesson's takeaways — no separate generic API call.
  const cards = day.flashcards ?? [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<number>>(new Set());

  // Reset the deck whenever the active day (or course) changes.
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setMastered(new Set());
  }, [course.id, day.dayNumber]);

  const handleNext = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev + 1) % cards.length), 150);
  };

  const handlePrev = () => {
    if (cards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length), 150);
  };

  const markMastered = () => {
    setMastered((prev) => new Set(prev).add(currentIndex));
    handleNext();
  };

  const resetProgress = () => {
    setMastered(new Set());
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // No cards yet. The deck no longer depends on the reader having opened the
  // lesson — the dashboard generates this day's content on demand — so this is
  // either "being written right now" or "generation failed, try again".
  if (cards.length === 0) {
    const failed = contentStatus === "error";
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 h-full">
        <div
          className={`w-24 h-24 bg-gradient-to-br from-[#00D4FF]/15 to-[#FF006E]/15 rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_30px_rgba(255,0,110,0.15)] ${
            failed ? "" : "animate-pulse"
          }`}
        >
          <Layers className="w-11 h-11 text-[#00D4FF]" strokeWidth={1.75} />
        </div>
        <h2 className="text-3xl font-bold mb-4">Smart Flashcards</h2>
        {failed ? (
          <>
            <p className="text-white/60 max-w-md leading-relaxed mb-6">
              We couldn&rsquo;t build <strong>Day {day.dayNumber}</strong>&rsquo;s cards just now.
            </p>
            <Button
              onClick={onRetryContent}
              className="h-12 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-8 font-bold text-white transition-transform hover:scale-105"
            >
              Try Again
            </Button>
          </>
        ) : (
          <p className="text-white/60 max-w-md leading-relaxed">
            Writing <strong>Day {day.dayNumber}</strong>&rsquo;s flashcards from the book&hellip; this takes a few seconds.
          </p>
        )}
      </div>
    );
  }

  const activeCard = cards[currentIndex] ?? cards[0];
  const masteredCount = mastered.size;
  const isActiveMastered = mastered.has(currentIndex);

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in pb-24 md:pb-8">

      {/* Header Info */}
      <div className="flex justify-between items-center mb-8 bg-[#1a1a1a] p-4 rounded-xl border border-white/10 shadow-lg">
        <div>
          <div className="text-xs text-[#00D4FF] font-bold uppercase tracking-wider mb-1">Day {day.dayNumber} · Deck Progress</div>
          <div className="text-lg font-bold">{masteredCount} / {cards.length} Mastered</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetProgress} className="bg-transparent border-white/20 hover:bg-white/10 text-white">Reset</Button>
        </div>
      </div>

      {/* 3D Flashcard Container */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">

        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Card</span>
          <span className="rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-5 py-1.5 text-lg font-black tabular-nums text-white shadow-[0_0_20px_rgba(0,212,255,0.3)]">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>

        {/* The Card - Uses Tailwind arbitrary values for 3D transforms */}
        <div
          className="relative w-full max-w-lg h-80 md:h-96 cursor-pointer group perspective-[1000px]"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div
            className="w-full h-full relative"
            style={{
              transition: "transform 0.6s",
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
            }}
          >

            {/* Front of card */}
            <div
              className="absolute inset-0 w-full h-full bg-[#111] border-2 border-white/10 rounded-3xl overflow-hidden flex flex-col text-center shadow-2xl group-hover:border-[#00D4FF]/50 transition-colors"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <span className="absolute top-5 left-5 z-10 text-xs font-bold text-[#00D4FF] uppercase tracking-widest bg-[#00D4FF]/10 px-3 py-1 rounded-full">Question</span>
              <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 pt-16 pb-12">
                <h3 className="text-xl md:text-2xl font-bold leading-snug">{activeCard.front}</h3>
              </div>
              <p className="absolute bottom-5 left-0 right-0 text-sm text-white/30 italic">Click to flip</p>
            </div>

            {/* Back of card */}
            <div
              className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-2 border-[#FF006E]/50 rounded-3xl overflow-hidden flex flex-col text-center shadow-[0_0_30px_rgba(255,0,110,0.15)]"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <span className="absolute top-5 left-5 z-10 text-xs font-bold text-[#FF006E] uppercase tracking-widest bg-[#FF006E]/10 px-3 py-1 rounded-full">Answer</span>
              <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 pt-16 pb-8">
                <div className="text-base md:text-lg text-white/90 leading-relaxed">{activeCard.back}</div>
              </div>
            </div>

          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-8 w-full max-w-lg justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            className="w-14 h-14 rounded-full border-white/20 bg-transparent hover:bg-white/10"
          >
            ←
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={handleNext}
              className="h-14 px-6 bg-[#1a1a1a] border border-white/20 text-white hover:bg-white/10 font-bold rounded-xl"
            >
              Review Again
            </Button>
            <Button
              onClick={markMastered}
              disabled={isActiveMastered}
              className="h-14 px-6 bg-gradient-to-r from-[#00D4FF] to-[#0096ff] text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {isActiveMastered ? "Mastered ✓" : "Got It ✓"}
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            className="w-14 h-14 rounded-full border-white/20 bg-transparent hover:bg-white/10"
          >
            →
          </Button>
        </div>

      </div>
    </div>
  );
}
