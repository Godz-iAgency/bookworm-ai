"use client"

import { useState, type ReactNode } from "react"

interface FeatureFlipCardProps {
  icon: ReactNode
  title: string
  /** ~20-word description shown on the back of the card. */
  back: string
}

/**
 * Landing-page feature card that flips on tap/click to reveal a short
 * description. Built mobile-first: a single tap toggles the flip, and it is
 * keyboard accessible (Enter / Space). The 3D properties (perspective,
 * preserve-3d, backface-visibility) and the transition are set via inline
 * styles so the flip does not depend on Tailwind utility generation.
 */
export function FeatureFlipCard({ icon, title, back }: FeatureFlipCardProps) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="h-56 cursor-pointer select-none"
      style={{ perspective: "1000px" }}
      role="button"
      tabIndex={0}
      aria-label={`${title}. Tap to flip for details.`}
      aria-pressed={flipped}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setFlipped((f) => !f)
        }
      }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl border border-white/10 bg-[#111]/80 p-6 shadow-xl backdrop-blur-md"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <div className="mb-4 text-4xl">{icon}</div>
          <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
          <span className="mt-auto text-xs text-white/40">Tap to flip →</span>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#00D4FF]/20 to-[#FF006E]/20 p-6 shadow-xl backdrop-blur-md"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>
          <p className="text-sm leading-relaxed text-white/85">{back}</p>
          <span className="mt-4 text-xs text-white/40">← Tap to flip back</span>
        </div>
      </div>
    </div>
  )
}
