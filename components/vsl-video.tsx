"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { Play, X } from "lucide-react"

/**
 * The landing page's explainer video: a vertical YouTube Short.
 *
 * Two ways to watch it, both real YouTube iframes on the privacy-enhanced
 * youtube-nocookie domain (no tracking cookies until the visitor presses
 * play):
 *   - VslLink: a visible "See how it works" link right under the hero's
 *     Start Learning button. Tapping it opens the video in a pop-up that
 *     starts playing. The iframe exists only while the pop-up is open, so
 *     closing it stops the video.
 *   - VslVideo: the same video in a phone-shaped frame further down the page,
 *     lazy-loaded and never autoplaying.
 */
const VIDEO_ID = "k3a3QxEfagk"
const TITLE = "Bookworm AI: turn any book into a 7-day course"
const IFRAME_ALLOW = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"

const embedUrl = (autoplay: boolean) =>
  `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?rel=0&playsinline=1&modestbranding=1${autoplay ? "&autoplay=1" : ""}`

const TRIGGERS = {
  // Under the hero's Start Learning button.
  hero: {
    label: "See how it works",
    className:
      "mt-4 inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-5 py-2 text-sm font-semibold text-[#00D4FF] transition-colors hover:bg-[#00D4FF]/20",
  },
  // In the top navigation, where it replaces the old Explore Benefits button.
  // Kept as short as that button so the header does not look crowded.
  header: {
    label: "How It Works",
    className:
      "inline-flex items-center gap-1.5 rounded-full border border-[#00D4FF]/40 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white/10",
  },
} as const

export function VslLink({ variant = "hero" }: { variant?: keyof typeof TRIGGERS }) {
  const { label, className } = TRIGGERS[variant]
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className={className}>
          <Play className="h-3.5 w-3.5 fill-current text-[#00D4FF]" aria-hidden="true" />
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 aspect-[9/16] w-[min(92vw,calc(82dvh*0.5625))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/15 bg-black shadow-[0_0_60px_rgba(0,212,255,0.3)] focus:outline-none"
        >
          <Dialog.Title className="sr-only">{TITLE}</Dialog.Title>
          {/* Before the iframe so it takes focus when the pop-up opens. Focus
              inside YouTube's player would swallow the Escape key. */}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close video"
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </Dialog.Close>
          <iframe
            src={embedUrl(true)}
            title={TITLE}
            className="absolute inset-0 h-full w-full"
            allow={IFRAME_ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function VslVideo() {
  return (
    <section aria-label="Watch how Bookworm AI works" className="mt-10 flex w-full flex-col items-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#00D4FF]">See how it works</p>
      <div className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-3xl border border-white/15 bg-black shadow-[0_0_40px_rgba(0,212,255,0.25)]">
        <iframe
          src={embedUrl(false)}
          title={TITLE}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow={IFRAME_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  )
}
