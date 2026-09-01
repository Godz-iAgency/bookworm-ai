"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Entropy } from "@/components/ui/entropy"
import { FeatureFlipCard } from "@/components/feature-flip-card"
import { CalendarDays, MessageCircle, Layers } from "lucide-react"
import { useEffect, useState } from "react"

export default function LandingPage() {
  const router = useRouter()
  // Responsive entropy sizing
  const [entropySize, setEntropySize] = useState(560)
  const [showTop, setShowTop] = useState(false)
  
  useEffect(() => {
    const updateSize = () => {
      // Sized to form a halo around the logo it sits behind. It used to be
      // 1.5x the largest viewport edge — far bigger than the logo — because it
      // was then a full-page backdrop rather than anchored to the mark.
      setEntropySize(Math.min(Math.max(window.innerWidth * 1.4, 420), 760))
    }
    window.addEventListener('resize', updateSize)
    updateSize()
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Show the back-to-top button once the user has scrolled down a bit.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300)
    window.addEventListener("scroll", onScroll)
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const scrollToBenefits = () => {
    // Scroll all the way to the bottom so every feature card is reachable.
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // dvh, not vh, throughout the hero: on a phone `100vh` measures the viewport
  // as if the URL bar and nav bar weren't there, so the hero was sized ~150px
  // taller than the screen actually shows, pushing the CTA under the fold.
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black">

      {/* Top navigation */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-5">
        {/* Left — jumps down to the feature cards (so mobile users don't have to discover the scroll) */}
        <button
          type="button"
          onClick={scrollToBenefits}
          className="rounded-full border border-[#00D4FF]/40 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white/10"
        >
          Explore Benefits ↓
        </button>
        {/* Right — returning users log in here */}
        <Link
          href="/login"
          className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white/10"
        >
          Login
        </Link>
      </header>

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center px-6 pb-10 pt-16 sm:pt-20">
        {/* The entropy field is anchored to the logo rather than to the page.
            It used to be `absolute inset-0` on a container as tall as the
            whole scrollable page, which centred it far below the fold. */}
        <div className="relative mb-5 flex flex-col items-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40"
          >
            <Entropy size={entropySize} />
          </div>
          <Image
            src="/bookworm-logo.png"
            alt="Bookworm.AI Logo"
            width={400}
            height={400}
            // max-h in dvh keeps the mark proportional to the screen the
            // reader actually has, so a short phone can't let it push
            // "Start Learning" below the fold. Lifted on larger screens.
            className="relative z-10 h-auto w-56 max-h-[26dvh] object-contain drop-shadow-2xl light-glow sm:max-h-none sm:w-80 md:w-96"
            priority
          />
        </div>

        {/* Hero text */}
        <div className="max-w-3xl text-center backdrop-blur-sm bg-black/20 p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl word-float">
          <p className="mb-6 text-base sm:text-lg leading-relaxed text-white/90">
            Transform your reading experience with AI-powered courses, interactive lessons, and personalized flashcards.
            Turn any book into a 7-day learning journey.
          </p>

          <div className="flex flex-col items-center justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-8 py-6 text-lg font-bold text-white rounded-full transition-all hover:scale-105 lighting-button shadow-[0_0_30px_rgba(0,212,255,0.4)] hover:shadow-[0_0_50px_rgba(255,0,110,0.6)]"
              asChild
            >
              <Link href="/signup">
                Start Learning
              </Link>
            </Button>
          </div>
          
          <div className="mt-5 text-center text-xs space-y-2 font-mono text-white/50 w-full flex flex-col items-center">
            <p className="italic tracking-wide">
              &ldquo;Order and chaos dance &mdash;
              <span className="opacity-70"> digital poetry in motion.&rdquo;</span>
            </p>
          </div>
        </div>

        {/* Features — tap any card to flip it for more detail */}
        <div id="features" className="mt-20 grid w-full max-w-5xl scroll-mt-24 gap-8 md:grid-cols-3">
          <FeatureFlipCard
            icon={<CalendarDays className="w-9 h-9 text-[#00D4FF]" strokeWidth={1.75} />}
            title="7-Day Courses"
            back="Each day unlocks one focused lesson taught through a named framework, plus three takeaway assignments to apply the idea right away."
          />
          <FeatureFlipCard
            icon={<MessageCircle className="w-9 h-9 text-[#FF006E]" strokeWidth={1.75} />}
            title="AI Chat Assistant"
            back="Ask anything about the book and get tight, concept-grounded answers pulled from that day's lesson — a tutor who already read it."
          />
          <FeatureFlipCard
            icon={<Layers className="w-9 h-9 text-[#00D4FF]" strokeWidth={1.75} />}
            title="Smart Flashcards"
            back="Three quick-flip cards each day test what you learned, so the book's key ideas stick long after day seven."
          />
        </div>

        {/* Google Play requires the account-deletion route to be reachable
            without the app installed, so it is linked from the public
            landing page rather than only from inside the dashboard. */}
        <footer className="mt-20 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-14 text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} Bookworm.AI</span>
          <Link href="/delete-account" className="transition-colors hover:text-white/70">
            Delete your account
          </Link>
        </footer>
      </div>

      {/* Back-to-top button — appears after scrolling down */}
      {showTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] transition-transform hover:scale-110"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
