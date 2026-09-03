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
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in pb-8">

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

        {/* The Card - Uses Tailwind arbitrary values for 3D transforms.
            Locked to the artwork's 4:3 instead of a fixed height: the faces are
            designed images with the label, logo and caption drawn at fixed
            positions, so any other ratio would either crop them or letterbox
            them. At md this is the same size the old h-96 gave. */}
        <div
          className="relative w-full max-w-lg aspect-[4/3] cursor-pointer group perspective-[1000px]"
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

            {/* Front of card.
                The face is artwork: it already draws the border, the QUESTION
                label, the logo and the "Click to flip" caption. The DOM copies
                of those are kept as sr-only rather than deleted — they carried
                the only machine-readable "this is the question side", and a
                background image is invisible to a screen reader. */}
            <div
              className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden flex flex-col text-center shadow-2xl"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <img
                src="/brand/flashcard-question.webp"
                alt=""
                aria-hidden="true"
                // Not lazy: inside a preserve-3d/backface-hidden subtree the
                // browser's lazy-load intersection check never fires and the
                // image simply never requests. See components/feature-flip-card.
                decoding="async"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              <span className="sr-only">Question</span>
              {/* Positioned against the artwork rather than the box: the design
                  leaves the band under the logo clear, and percentages of
                  height track it at every card size. */}
              {/* The mask only bites when the text is taller than the band —
                  normal cards are centred and never reach the edges. The
                  generator asks for 5–10 word fronts and 10–15 word backs, so
                  overflow means a model overshot its brief; this makes that
                  fade out and invite a scroll instead of looking like a
                  rendering fault with lines sliced in half. */}
              <div className="absolute inset-x-0 top-[26%] bottom-[14%] z-10 flex items-center justify-center overflow-y-auto px-[9%] [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
                <h3 className="text-lg md:text-2xl font-bold leading-snug [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">
                  {activeCard.front}
                </h3>
              </div>
              <span className="sr-only">Click to flip</span>
            </div>

            {/* Back of card */}
            <div
              className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden flex flex-col text-center shadow-[0_0_30px_rgba(255,0,110,0.15)]"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <img
                src="/brand/flashcard-answer.webp"
                alt=""
                aria-hidden="true"
                decoding="async"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
              <span className="sr-only">Answer</span>
              {/* The mask only bites when the text is taller than the band —
                  normal cards are centred and never reach the edges. The
                  generator asks for 5–10 word fronts and 10–15 word backs, so
                  overflow means a model overshot its brief; this makes that
                  fade out and invite a scroll instead of looking like a
                  rendering fault with lines sliced in half. */}
              <div className="absolute inset-x-0 top-[26%] bottom-[14%] z-10 flex items-center justify-center overflow-y-auto px-[9%] [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]">
                <div className="text-sm md:text-lg text-white/95 leading-relaxed [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">
                  {activeCard.back}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Controls — the arrows are shrink-0 and the middle pair flexes, so
            the "next" arrow can't be pushed off a 370px-wide phone screen. */}
        <div className="mt-8 flex w-full max-w-lg items-center gap-2 sm:gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            aria-label="Previous card"
            className="h-12 w-12 shrink-0 rounded-full border-white/20 bg-transparent hover:bg-white/10 sm:h-14 sm:w-14"
          >
            ←
          </Button>

          <div className="flex min-w-0 flex-1 gap-2 sm:gap-3">
            <Button
              onClick={handleNext}
              className="h-12 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#1a1a1a] px-2 text-sm font-bold text-white hover:bg-white/10 sm:h-14 sm:px-6 sm:text-base"
            >
              Review Again
            </Button>
            <Button
              onClick={markMastered}
              disabled={isActiveMastered}
              className="h-12 min-w-0 flex-1 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#0096ff] px-2 text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 sm:h-14 sm:px-6 sm:text-base"
            >
              {isActiveMastered ? "Mastered ✓" : "Got It ✓"}
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleNext}
            aria-label="Next card"
            className="h-12 w-12 shrink-0 rounded-full border-white/20 bg-transparent hover:bg-white/10 sm:h-14 sm:w-14"
          >
            →
          </Button>
        </div>

      </div>
    </div>
  );
}
