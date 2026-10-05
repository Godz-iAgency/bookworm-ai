"use client";

import { useEffect, useState } from "react";

/**
 * Friendly animated loader shown inline while a day's lesson is generated.
 *
 * The bar fills from empty as time passes, so a slow generation visibly keeps
 * moving instead of looking stuck in a loop. There is no real progress signal
 * from the model, so it eases toward 95% and never reaches the end on its own:
 * a typical lesson (about 20 to 40 seconds) lands around half to
 * three-quarters, a slow one (two minutes) creeps into the 90s, and it
 * completes when the lesson arrives and the loader is replaced. The message
 * follows the bar through the stages of writing a day.
 */
const LOADER_TIME_CONSTANT_S = 22;

export function DayLoader({ dayNumber, startedAt, className = "mt-6 border-t border-white/10 pt-8 pb-4" }: {
  dayNumber: number;
  /** When writing began, so a loader shown later picks up where the work is. */
  startedAt?: number;
  className?: string;
}) {
  const stages: [number, string][] = [
    [0, "Opening the book…"],
    [12, `Planning Day ${dayNumber}…`],
    [30, "Gathering the key ideas…"],
    [50, "Writing your lesson…"],
    [78, "Building your flashcards…"],
    [90, "Almost ready…"],
  ];
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startedAt ?? Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 250);
    return () => clearInterval(t);
  }, [startedAt]);

  const progress = 95 * (1 - Math.exp(-elapsed / LOADER_TIME_CONSTANT_S));
  const message = [...stages].reverse().find(([at]) => progress >= at)?.[1] ?? stages[0][1];

  return (
    <div className={`relative z-10 flex flex-col items-center text-center animate-in fade-in duration-300 ${className}`}>
      <style>{`
        @keyframes dl-slide { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes dl-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
      `}</style>

      <div className="mb-5 text-5xl" style={{ animation: "dl-float 1.6s ease-in-out infinite" }}>
        📖
      </div>

      <div
        className="mb-5 h-2.5 w-full max-w-xs overflow-hidden rounded-full border border-white/5 bg-white/10"
        role="progressbar"
        aria-label="Writing your lesson"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] via-[#FF006E] to-[#00D4FF]"
          style={{
            width: `${progress}%`,
            transition: "width 250ms linear",
            backgroundSize: "200% auto",
            animation: "dl-slide 1.5s linear infinite",
          }}
        />
      </div>

      <p className="animate-pulse bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-lg font-bold text-transparent">
        {message}
      </p>
      <p className="mt-2 text-sm text-white/50">A full lesson can take a minute or two to write.</p>
    </div>
  );
}
