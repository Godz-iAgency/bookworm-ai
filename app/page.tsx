"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Entropy } from "@/components/ui/entropy"
import { Logo } from "@/components/logo"
import { FeatureFlipCard } from "@/components/feature-flip-card"
import { VslLink, VslVideo } from "@/components/vsl-video"
import { CalendarDays, MessageCircle, Layers, ChevronDown } from "lucide-react"
import { AppJsonLd } from "@/components/json-ld"
import { useEffect, useState } from "react"

export default function LandingPage() {
  const router = useRouter()
  // Responsive entropy sizing
  const [entropySize, setEntropySize] = useState(560)
  const [showTop, setShowTop] = useState(false)
  
  useEffect(() => {
    const updateSize = () => {
      // Sized to form a halo around the logo it sits behind. It used to be
      // 1.5x the largest viewport edge - far bigger than the logo - because it
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const scrollToBenefits = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // dvh, not vh, throughout the hero: on a phone `100vh` measures the viewport
  // as if the URL bar and nav bar weren't there, so the hero was sized ~150px
  // taller than the screen actually shows, pushing the CTA under the fold.
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black">
      <AppJsonLd />
      {/* The hero is a logo and a sentence, so the page's main heading is read by search engines and screen readers rather than shown. */}
      <h1 className="sr-only">Bookworm AI: turn any book into a 7-day learning course</h1>

      {/* Top navigation */}
      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 py-5">
        {/* Left - opens the explainer video, playing. */}
        <VslLink />
        {/* Right - returning users log in here */}
        <Link
          href="/login"
          className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-white/10"
        >
          Login
        </Link>
      </header>

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center px-3 pb-10 pt-16 sm:pt-20">
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
          {/* Width-driven, so the mark, wordmark and tagline keep their
              proportions on any screen instead of being squashed into a fixed
              box. The stack is shorter than the old square lockup was at the
              same width, so "Start Learning" stays above the fold on a short
              phone without needing a dvh cap. */}
          <Logo
            variant="stacked"
            tagline
            priority
            className="relative z-10 w-56 drop-shadow-2xl light-glow sm:w-72 md:w-80"
          />
        </div>

        {/* Hero text */}
        <div className="max-w-3xl text-center backdrop-blur-sm bg-black/20 px-4 py-6 sm:px-6 sm:py-8 rounded-3xl border border-white/10 shadow-2xl word-float">
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
            <button
              type="button"
              onClick={scrollToBenefits}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-5 py-2 text-sm font-semibold text-[#00D4FF] transition-colors hover:bg-[#00D4FF]/20"
            >
              Explore Benefits
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          
          <div className="mt-5 text-center text-xs space-y-2 font-mono text-white/50 w-full flex flex-col items-center">
            <p className="italic tracking-wide">
              &ldquo;Order and chaos dance,
              <span className="opacity-70"> digital poetry in motion.&rdquo;</span>
            </p>
          </div>
        </div>

        {/* Explainer video: below the hero so "Start Learning" stays above the fold. */}
        <VslVideo />

        {/* Features - tap any card to flip it for more detail */}
        <div id="features" className="mt-20 grid w-full max-w-5xl scroll-mt-24 gap-8 md:grid-cols-3">
          <FeatureFlipCard
            icon={<CalendarDays className="w-9 h-9 text-[#00D4FF]" strokeWidth={1.75} />}
            title="7-Day Courses"
            back="Each day unlocks one focused lesson taught through a named framework, plus three takeaway assignments to apply the idea right away."
            background="/brand/card-courses.webp"
          />
          <FeatureFlipCard
            icon={<MessageCircle className="w-9 h-9 text-[#FF006E]" strokeWidth={1.75} />}
            title="AI Chat Assistant"
            back="Ask anything about the book and get tight, concept-grounded answers pulled from that day's lesson, like a tutor who already read it."
            background="/brand/card-chat.webp"
          />
          <FeatureFlipCard
            icon={<Layers className="w-9 h-9 text-[#00D4FF]" strokeWidth={1.75} />}
            title="Smart Flashcards"
            back="Three quick-flip cards each day test what you learned, so the book's key ideas stick long after day seven."
            background="/brand/card-flashcards.webp"
          />
        </div>

        {/* How it works and the common questions. Real, readable text: a page
            that is only a logo and one sentence tells a search engine almost
            nothing about what the product is. Every claim here is one the app
            already makes elsewhere. */}
        <section aria-labelledby="how-it-works" className="mt-20 w-full max-w-5xl">
          <h2 id="how-it-works" className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
            How Bookworm AI works
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["1", "Pick a book", "Type the title or scan the cover with your camera. Bookworm AI turns it into a 7-day course."],
              ["2", "Choose how you learn", "Pick the reading level that suits you, Explorer, Scholar or Architect, and read in English, Spanish or French."],
              ["3", "Read one lesson a day", "Each day brings a focused lesson, three actions to apply the idea, flashcards, and an AI chat that answers questions about the book."],
            ].map(([n, title, text]) => (
              <li key={n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00D4FF]/15 text-sm font-black text-[#00D4FF]">
                  {n}
                </span>
                <h3 className="mt-3 text-base font-bold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq" className="mt-16 w-full max-w-3xl">
          <h2 id="faq" className="text-center text-2xl font-black tracking-tight text-white sm:text-3xl">
            Questions
          </h2>
          <div className="mt-6 space-y-3">
            {[
              ["What is Bookworm AI?", "Bookworm AI turns any book into a 7-day course. Each day has one focused lesson, three actions to apply the idea, three flashcards, and an AI chat that answers questions about the book."],
              ["Is it free to try?", "Day 1 is free to read. Add a card to unlock Days 2 to 7. You are not charged during the 7-day trial, and you can cancel before it ends."],
              ["Which languages and reading levels are there?", "Lessons are written in English, Spanish or French, at three reading levels: Explorer for plain, simple explanations, Scholar for the author's own depth, and Architect for direct, action-first teaching."],
              ["How long does a course stay on my shelf?", "A course stays on your shelf for about a week, then clears to keep your shelf focused. Read one lesson a day and finish all seven before it goes."],
              ["Can I share Bookworm AI with family or friends?", "The Book Club plan lets up to four people share one subscription and see the books each other shares."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-white">
                  {q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-white/65">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-5 text-center text-sm text-white/55">
            See{" "}
            <Link href="/pricing" className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline">
              pricing
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="font-semibold text-[#00D4FF] underline-offset-2 hover:underline">
              contact us
            </Link>
            .
          </p>
        </section>

        {/* No account-deletion link here on purpose. Play requires the
            deletion route to work for someone with no app installed and no
            session - /delete-account does, and that URL is what gets declared
            in Play Console's Data Safety form. It stays linked from the
            privacy policy; it does not also need to sit in this footer. */}
        <footer className="mt-20 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pb-14 text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} Bookworm AI</span>
          <Link href="/pricing" className="transition-colors hover:text-white/70">
            Pricing
          </Link>
          <Link href="/contact" className="transition-colors hover:text-white/70">
            Contact
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white/70">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white/70">
            Privacy
          </Link>
        </footer>
      </div>

      {/* Back-to-top button - appears after scrolling down */}
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
