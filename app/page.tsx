"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Entropy } from "@/components/ui/entropy"
import { useEffect, useState } from "react"

export default function LandingPage() {
  const router = useRouter()
  // Responsive entropy sizing
  const [entropySize, setEntropySize] = useState(800)
  
  useEffect(() => {
    const updateSize = () => {
      setEntropySize(Math.max(window.innerWidth, window.innerHeight) * 1.5)
    }
    window.addEventListener('resize', updateSize)
    updateSize()
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      
      {/* Animated Entropy Background Element */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-40">
        <Entropy size={entropySize} className="pointer-events-none" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/bookworm-logo.png" alt="Bookworm.AI Logo" width={400} height={400} className="mb-6 drop-shadow-2xl light-glow" priority />
        </div>

        {/* Hero text */}
        <div className="max-w-3xl text-center backdrop-blur-sm bg-black/20 p-8 rounded-3xl border border-white/10 shadow-2xl word-float">
          <p className="mb-12 text-lg leading-relaxed text-white/90">
            Transform your reading experience with AI-powered courses, interactive lessons, and personalized flashcards.
            Turn any book into a 7-day learning journey.
          </p>

          <div className="flex flex-col items-center justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-8 py-6 text-lg font-bold text-white rounded-full transition-all hover:scale-105 lighting-button shadow-[0_0_30px_rgba(0,212,255,0.4)] hover:shadow-[0_0_50px_rgba(255,0,110,0.6)]"
              asChild
            >
              <Link href="/search">
                Start Learning — It's Free
              </Link>
            </Button>
          </div>
          
          <div className="mt-8 text-center text-xs space-y-2 font-mono text-white/50 w-full flex flex-col items-center">
            <p className="italic tracking-wide">
              &ldquo;Order and chaos dance &mdash;
              <span className="opacity-70"> digital poetry in motion.&rdquo;</span>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid max-w-5xl gap-8 md:grid-cols-3">
          <div className="rounded-2xl bg-[#111]/80 border border-white/10 p-6 backdrop-blur-md shadow-xl hover:-translate-y-2 transition-transform">
            <div className="mb-4 text-4xl">📚</div>
            <h3 className="mb-2 text-xl font-bold text-white">7-Day Courses</h3>
            <p className="text-white/60 text-sm">
              Every book becomes a structured 7-day learning experience with daily lessons and quizzes.
            </p>
          </div>
          <div className="rounded-2xl bg-[#111]/80 border border-white/10 p-6 backdrop-blur-md shadow-xl hover:-translate-y-2 transition-transform">
            <div className="mb-4 text-4xl text-[#00D4FF]">🤖</div>
            <h3 className="mb-2 text-xl font-bold text-white">AI Chat Assistant</h3>
            <p className="text-white/60 text-sm">Ask questions anytime and get instant answers powered by advanced AI.</p>
          </div>
          <div className="rounded-2xl bg-[#111]/80 border border-white/10 p-6 backdrop-blur-md shadow-xl hover:-translate-y-2 transition-transform">
            <div className="mb-4 text-4xl">🗂️</div>
            <h3 className="mb-2 text-xl font-bold text-white">Smart Flashcards</h3>
            <p className="text-white/60 text-sm">Save key insights and build your permanent knowledge vault as you read.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
