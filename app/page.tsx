"use client"

import { Entropy } from "@/components/ui/entropy"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function LandingPage() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Entropy background - full screen */}
      <div className="absolute inset-0 opacity-30">
        <Entropy size={typeof window !== "undefined" ? Math.max(window.innerWidth, window.innerHeight) : 1200} />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex flex-col items-center">
          <Image src="/bookworm-logo.png" alt="Bookworm.AI Logo" width={400} height={400} className="mb-6" priority />
        </div>

        {/* Hero text */}
        <div className="max-w-3xl text-center">
          <p className="mb-12 text-lg leading-relaxed text-white/70">
            Transform your reading experience with AI-powered courses, interactive lessons, and personalized flashcards.
            Turn any book into a 7-day learning journey.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-6 text-lg font-semibold text-white hover:from-cyan-600 hover:to-blue-700"
              onClick={() => router.push("/signup")}
            >
              Start Your Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 px-8 py-6 text-lg font-semibold text-white backdrop-blur-sm hover:bg-white/20"
              onClick={() => router.push("/login")}
            >
              Login
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid max-w-5xl gap-8 md:grid-cols-3">
          <div className="rounded-lg bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-4 text-4xl">📚</div>
            <h3 className="mb-2 text-xl font-semibold text-white">7-Day Courses</h3>
            <p className="text-white/70">
              Every book becomes a structured 7-day learning experience with daily lessons and quizzes.
            </p>
          </div>
          <div className="rounded-lg bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-4 text-4xl">🤖</div>
            <h3 className="mb-2 text-xl font-semibold text-white">AI Chat Assistant</h3>
            <p className="text-white/70">Ask questions anytime and get instant answers powered by advanced AI.</p>
          </div>
          <div className="rounded-lg bg-white/5 p-6 backdrop-blur-sm">
            <div className="mb-4 text-4xl">💾</div>
            <h3 className="mb-2 text-xl font-semibold text-white">Smart Flashcards</h3>
            <p className="text-white/70">Save key insights and build your permanent knowledge vault as you read.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
