"use client"
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Ripple, AuthTabs, TechOrbitDisplay } from "@/components/auth/modern-animated-sign-in"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { demoSignup } from "@/lib/demo-auth"

type FormData = {
  name: string
  email: string
  password: string
}

interface OrbitIcon {
  component: () => ReactNode
  className: string
  duration?: number
  delay?: number
  radius?: number
  path?: boolean
  reverse?: boolean
}

const iconsArray: OrbitIcon[] = [
  {
    component: () => <div className="text-4xl">📚</div>,
    className: "size-[40px] border-none bg-transparent",
    duration: 20,
    delay: 20,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => <div className="text-4xl">🤖</div>,
    className: "size-[40px] border-none bg-transparent",
    duration: 20,
    delay: 10,
    radius: 100,
    path: false,
    reverse: false,
  },
  {
    component: () => <div className="text-5xl">💾</div>,
    className: "size-[50px] border-none bg-transparent",
    radius: 210,
    duration: 20,
    path: false,
    reverse: false,
  },
  {
    component: () => <div className="text-5xl">✨</div>,
    className: "size-[50px] border-none bg-transparent",
    duration: 20,
    delay: 20,
    radius: 210,
    path: false,
    reverse: false,
  },
  {
    component: () => <div className="text-4xl">📖</div>,
    className: "size-[40px] border-none bg-transparent",
    radius: 150,
    duration: 20,
    delay: 20,
    path: false,
    reverse: true,
  },
  {
    component: () => <div className="text-4xl">🎯</div>,
    className: "size-[40px] border-none bg-transparent",
    radius: 150,
    duration: 20,
    delay: 10,
    path: false,
    reverse: true,
  },
  {
    component: () => <div className="text-5xl">🧠</div>,
    className: "size-[50px] border-none bg-transparent",
    radius: 270,
    duration: 20,
    path: false,
    reverse: true,
  },
  {
    component: () => <div className="text-5xl">💡</div>,
    className: "size-[50px] border-none bg-transparent",
    radius: 270,
    duration: 20,
    delay: 60,
    path: false,
    reverse: true,
  },
]

const AVAILABLE_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Science Fiction",
  "Fantasy",
  "Romance",
  "Thriller",
  "Biography",
  "History",
  "Self-Help",
  "Business",
  "Philosophy",
]

export default function SignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState<"signup" | "genres">("signup")
  const [userId, setUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: "Demo User",
    email: "demo@bookworm.ai",
    password: "demo123",
  })
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [lastBook, setLastBook] = useState("")
  const [loading, setLoading] = useState(false)

  const goToSignIn = (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    event.preventDefault()
    router.push("/login")
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>, name: keyof FormData) => {
    const value = event.target.value

    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    // Form validation and API submission logic would go here

    if (demoSignup(formData.name, formData.email, formData.password)) {
      // Handle success
      setUserId("demo-user-123")
      setStep("genres")
      setLoading(false)
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      alert("Using demo mode. Continue to genre selection.")
      setUserId("demo-user-123")
      setStep("genres")
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
        },
      })

      if (error) {
        alert(`Error: ${error.message}`)
        setLoading(false)
        return
      }

      setUserId(data.user?.id || null)
      setStep("genres")
    } catch (error) {
      console.error("[v0] Signup error:", error)
      alert("An error occurred during signup. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre)
      }
      if (prev.length < 3) {
        return [...prev, genre]
      }
      return prev
    })
  }

  const handleGenreSubmit = async () => {
    if (selectedGenres.length !== 3) {
      alert("Please select exactly 3 genres")
      return
    }

    if (!lastBook.trim()) {
      alert("Please enter the last book you read")
      return
    }

    setLoading(true)

    if (userId === "demo-user-123") {
      const demoUser = JSON.parse(localStorage.getItem("demo_user") || "{}")
      demoUser.genres = selectedGenres
      demoUser.last_read = lastBook
      localStorage.setItem("demo_user", JSON.stringify(demoUser))
      router.push("/dashboard")
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      alert("Database not configured")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from("users")
        .update({
          genres: selectedGenres,
          last_read: lastBook,
        })
        .eq("id", userId)

      if (error) {
        console.error("[v0] Error updating preferences:", error)
        alert(`Error: ${error.message}`)
        setLoading(false)
        return
      }

      router.push("/dashboard")
    } catch (error) {
      console.error("[v0] Genre submission error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const formFields = {
    header: "Start Your Free Trial",
    subHeader: "Create your Bookworm.AI account and transform your reading experience",
    fields: [
      {
        label: "Name",
        required: true,
        type: "text",
        placeholder: "Enter your full name",
        value: formData.name,
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "name"),
      },
      {
        label: "Email",
        required: true,
        type: "email",
        placeholder: "Enter your email address",
        value: formData.email,
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "email"),
      },
      {
        label: "Password",
        required: true,
        type: "password",
        placeholder: "Create a strong password",
        value: formData.password,
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "password"),
      },
    ],
    submitButton: "Create Account",
    textVariantButton: "Already have an account? Sign in",
  }

  return (
    <section className="flex max-lg:justify-center min-h-screen bg-[hsl(222,94%,5%)]">
      {/* Left Side - Animated Background */}
      <span className="flex flex-col justify-center w-1/2 max-lg:hidden relative">
        <Ripple mainCircleSize={100} />
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Oct%205%2C%202025%2C%2010_40_41%20PM-H6XfD24mrebcr7PyZI2hKrfdpYpiFW.png"
            alt="Bookworm.AI Logo"
            width={120}
            height={120}
            priority
          />
        </div>
        <TechOrbitDisplay iconsArray={iconsArray} text="Bookworm.AI" />
      </span>

      {/* Right Side - Sign Up Form or Genre Selection */}
      <span className="w-1/2 min-h-screen flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%]">
        {step === "signup" ? (
          <>
            <div className="mb-4 px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm max-w-md text-center">
              Demo credentials prefilled for 7-day free trial
            </div>
            <AuthTabs formFields={formFields} goTo={goToSignIn} handleSubmit={handleSubmit} />
          </>
        ) : (
          <div className="max-w-2xl w-full px-8">
            <h2 className="text-3xl font-bold text-white mb-2">Pick 3 genres you love</h2>
            <p className="text-gray-400 mb-8">Help us personalize your reading experience</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
              {AVAILABLE_GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => handleGenreToggle(genre)}
                  disabled={!selectedGenres.includes(genre) && selectedGenres.length >= 3}
                  className={`px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                    selectedGenres.includes(genre)
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-[hsl(219,63%,16%)] border-[hsl(217,32.6%,17.5%)] text-gray-300 hover:border-cyan-500/50"
                  } ${!selectedGenres.includes(genre) && selectedGenres.length >= 3 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {genre}
                </button>
              ))}
            </div>

            <div className="mb-8">
              <label htmlFor="lastBook" className="block text-gray-200 mb-2 font-medium">
                Last book you read?
              </label>
              <input
                type="text"
                id="lastBook"
                value={lastBook}
                onChange={(e) => setLastBook(e.target.value)}
                placeholder="Enter the title of the last book you read"
                className="w-full px-4 py-3 rounded-lg bg-[hsl(219,63%,16%)] border-2 border-[hsl(217,32.6%,17.5%)] text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>

            <button
              onClick={handleGenreSubmit}
              disabled={loading || selectedGenres.length !== 3 || !lastBook.trim()}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-3 rounded-lg font-medium shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up your account..." : "Continue to Dashboard →"}
            </button>

            <p className="text-center text-gray-400 text-sm mt-4">{selectedGenres.length}/3 genres selected</p>
          </div>
        )}
      </span>
    </section>
  )
}
