"use client"
import { useState, useEffect } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Mic, Search, Flame } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { SubscriptionGuard } from "@/components/subscription-guard"
import { isDemoMode, getDemoUser } from "@/lib/demo-auth"

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [bookInput, setBookInput] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [suggestedBook, setSuggestedBook] = useState<{ title: string; author: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    if (isDemoMode()) {
      const demoUser = getDemoUser()
      if (demoUser) {
        setUser({
          name: demoUser.name,
          email: demoUser.email,
          genres: demoUser.genres,
          last_read: demoUser.last_read,
          streak_count: demoUser.streak,
        })
        setLoading(false)
        return
      }
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      console.log("[v0] Supabase not configured, redirecting to login")
      router.push("/login")
      return
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      router.push("/login")
      return
    }

    loadUserData()
  }

  const loadUserData = async () => {
    try {
      const response = await fetch("/api/user/profile")
      const data = await response.json()

      if (data.user) {
        setUser(data.user)
        updateStreak(data.user)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateStreak = async (userData: any) => {
    const today = new Date().toISOString().split("T")[0]
    const lastActive = userData.last_active

    if (lastActive !== today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split("T")[0]

      const newStreak = lastActive === yesterdayStr ? userData.streak_count + 1 : 1

      await fetch("/api/user/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streakCount: newStreak }),
      })

      setUser({ ...userData, streak_count: newStreak, last_active: today })
    }
  }

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Voice input is not supported in your browser")
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setBookInput(transcript)
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
      alert("Error with voice recognition. Please try again.")
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!bookInput.trim()) {
      alert("Please enter a book title")
      return
    }

    // Simulate book lookup and confirmation
    // In production, this would call an API to verify the book
    setSuggestedBook({
      title: bookInput,
      author: "Unknown Author",
    })
    setShowConfirmation(true)
  }

  const handleConfirmBook = async (confirmed: boolean) => {
    if (confirmed && suggestedBook) {
      router.push(
        `/course/generate?title=${encodeURIComponent(suggestedBook.title)}&author=${encodeURIComponent(suggestedBook.author)}`,
      )
    } else {
      setShowConfirmation(false)
      setSuggestedBook(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDD0] flex items-center justify-center">
        <div className="text-[#008080] text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <SubscriptionGuard>
      <div className="min-h-screen bg-[#FFFDD0]">
        {/* Top Bar */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Oct%205%2C%202025%2C%2010_40_41%20PM-H6XfD24mrebcr7PyZI2hKrfdpYpiFW.png"
                alt="Bookworm.AI Logo"
                width={50}
                height={50}
              />
              <h1 className="text-2xl font-bold text-[#008080]">Bookworm.AI</h1>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-[#FFFDD0] px-4 py-2 rounded-full">
                <Flame className="w-5 h-5 text-[#D4AF37]" fill="#D4AF37" />
                <span className="font-bold text-[#008080]">{user?.streak_count || 0}</span>
              </div>
              <span className="text-[#008080] font-medium">{user?.name}</span>
              <Link href="/settings" className="text-[#008080] hover:text-[#006666] font-medium underline">
                Settings
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#008080] mb-4">Welcome back, {user?.name}!</h2>
            <p className="text-lg text-gray-700">Transform any book into a personalized 7-day learning journey</p>
          </div>

          {!showConfirmation ? (
            <form onSubmit={handleBookSubmit} className="mb-12">
              <div className="relative">
                <input
                  type="text"
                  value={bookInput}
                  onChange={(e) => setBookInput(e.target.value)}
                  placeholder="Type a book title..."
                  className="w-full px-6 py-6 text-xl rounded-2xl bg-white shadow-lg border-2 border-transparent focus:border-[#008080] focus:outline-none transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`p-3 rounded-full transition-all ${
                      isListening
                        ? "bg-[#CC5500] text-white animate-pulse"
                        : "bg-[#FFFDD0] text-[#008080] hover:bg-[#008080] hover:text-white"
                    }`}
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                  <button
                    type="submit"
                    className="p-3 rounded-full bg-[#CC5500] text-white hover:bg-[#b34900] transition-all"
                  >
                    <Search className="w-6 h-6" />
                  </button>
                </div>
              </div>
              {isListening && <p className="text-center text-[#008080] mt-4 animate-pulse">Listening...</p>}
            </form>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
              <h3 className="text-2xl font-bold text-[#008080] mb-4">Did you mean this book?</h3>
              <div className="bg-[#FFFDD0] rounded-xl p-6 mb-6">
                <p className="text-xl font-bold text-[#008080] mb-2">{suggestedBook?.title}</p>
                <p className="text-gray-700">by {suggestedBook?.author}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleConfirmBook(true)}
                  className="flex-1 bg-[#008080] text-white py-4 rounded-xl font-bold hover:bg-[#006666] transition-all"
                >
                  Yes, that's it!
                </button>
                <button
                  onClick={() => handleConfirmBook(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-300 transition-all"
                >
                  No, try again
                </button>
              </div>
            </div>
          )}

          {/* Recent Courses or Suggestions */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-[#008080] mb-6">Your Favorite Genres</h3>
            <div className="flex flex-wrap gap-3">
              {user?.genres?.map((genre: string) => (
                <span key={genre} className="px-4 py-2 bg-[#008080] text-white rounded-full font-medium">
                  {genre}
                </span>
              ))}
            </div>
            {user?.last_read && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-gray-700">
                  <span className="font-bold text-[#008080]">Last book you read:</span> {user.last_read}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SubscriptionGuard>
  )
}
