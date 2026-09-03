"use client"

import { useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

interface FeatureFlipCardProps {
  icon: ReactNode
  title: string
  /** ~20-word description shown on the back of the card. */
  back: string
  /**
   * Optional artwork for the front face. Front only: the back is a paragraph
   * of text, and putting a picture behind it costs more legibility than the
   * decoration is worth.
   */
  background?: string
}

/**
 * Landing-page feature card that flips on tap/click to reveal a short
 * description. Built mobile-first: a single tap toggles the flip, and it is
 * keyboard accessible (Enter / Space). The 3D properties (perspective,
 * preserve-3d, backface-visibility) and the transition are set via inline
 * styles so the flip does not depend on Tailwind utility generation.
 */
export function FeatureFlipCard({ icon, title, back, background }: FeatureFlipCardProps) {
  const [flipped, setFlipped] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <div
      className="group h-56 cursor-pointer select-none transition-transform duration-300 hover:scale-[1.03]"
      style={{ perspective: "1000px" }}
      role="button"
      tabIndex={0}
      aria-label={`${title}. Tap to flip for details.`}
      aria-pressed={flipped}
      data-no-press
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setFlipped((f) => !f)
        }
      }}
    >
      {/* A spring rather than a 600ms curve: tapping twice quickly used to have
          to wait out the first flip, where a spring re-targets from the angle
          the card is currently at and carries its velocity through the
          reversal. Rotation is the one place Apple ship real bounce, so it
          keeps a little. */}
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={
          reduceMotion
            ? { duration: 0.2 }
            : { type: "spring", bounce: 0.2, duration: 0.45 }
        }
      >
        {/* Front — gradient border + glow, matching the in-app cards. */}
        <div
          className="absolute inset-0 flex flex-col rounded-2xl p-6 shadow-[0_0_22px_rgba(0,212,255,0.15)] transition-shadow duration-300 group-hover:shadow-[0_0_36px_rgba(0,212,255,0.32)]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            border: "1.5px solid transparent",
            background:
              "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
          }}
        >
          {background && (
            <>
              {/* Anchored right because every one of these illustrations puts
                  its subject on the right and leaves the left in shadow —
                  which is exactly where the icon and title sit. A plain <img>
                  rather than next/image: the file is already a hand-sized
                  WebP, and the card's width barely varies, so a srcset would
                  buy nothing. inset-0 resolves to the padding box, so it
                  cannot paint over the gradient border. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={background}
                alt=""
                aria-hidden="true"
                // Deliberately not loading="lazy". The card is a 3D context
                // (preserve-3d, backface-visibility: hidden) and the browser's
                // lazy-load intersection check never fires inside it — the
                // images simply never requested. All three together are 34KB,
                // so eager costs nothing to be correct.
                decoding="async"
                className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl object-cover object-right opacity-70"
              />
              {/* Scrim: fades the art out towards the left so the white title
                  keeps its contrast no matter what the artwork does. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-[#111] via-[#111]/75 to-transparent"
              />
            </>
          )}

          {/* Positioned, so it paints above the absolutely-positioned artwork
              — a static child would be painted under it regardless of order. */}
          <div className="relative flex flex-1 flex-col">
            <div className="mb-4 text-4xl">{icon}</div>
            <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
            <span className="mt-auto text-xs text-white/40">Tap to flip →</span>
          </div>
        </div>

        {/* Back — same gradient border, with a subtly tinted dark fill. */}
        <div
          className="absolute inset-0 flex flex-col justify-center rounded-2xl p-6 shadow-[0_0_22px_rgba(255,0,110,0.18)] transition-shadow duration-300 group-hover:shadow-[0_0_36px_rgba(255,0,110,0.34)]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            border: "1.5px solid transparent",
            background:
              "linear-gradient(150deg,#13212a,#241019) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
          }}
        >
          <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>
          <p className="text-sm leading-relaxed text-white/85">{back}</p>
          <span className="mt-4 text-xs text-white/40">← Tap to flip back</span>
        </div>
      </motion.div>
    </div>
  )
}
