"use client";

import { Logo } from "@/components/logo";
import { GENERATION_STEPS } from "@/lib/useCourseGeneration";

/**
 * The full-screen "building your course" animation. Shared so the two screens
 * that can start a course (/search and /reading-level) show the identical wait,
 * rather than one of them silently doing nothing for ten seconds.
 */
export function GeneratingOverlay({ step }: { step: number }) {
  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh w-full flex-col items-center justify-center bg-[#0a0a0a] p-6 text-white">
      <style>{`@keyframes slide-gradient { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }`}</style>
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Logo variant="stacked" priority className="mb-14 w-52 drop-shadow-2xl" />
        <div className="mb-8 h-3 w-full overflow-hidden rounded-full border border-white/5 bg-[#1a1a1a] shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] via-[#FF006E] to-[#00D4FF]"
            style={{
              backgroundSize: "200% auto",
              animation: "slide-gradient 2s linear infinite",
              width: `${((step + 1) / GENERATION_STEPS.length) * 100}%`,
              transition: "width 1.5s linear",
            }}
          />
        </div>
        <h2 className="h-10 animate-pulse bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-xl font-bold text-transparent md:text-2xl">
          {GENERATION_STEPS[step]}
        </h2>
      </div>
    </div>
  );
}
