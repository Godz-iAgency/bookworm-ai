"use client"
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Ripple, AuthTabs, TechOrbitDisplay } from "@/components/auth/modern-animated-sign-in"
import { signUpWithEmail, signInWithGoogle } from "@/lib/firebase/auth"
import { db } from "@/lib/firebase/config"
import { doc, updateDoc } from "firebase/firestore"

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
    name: "",
    email: "",
    password: "",
  })
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [lastBook, setLastBook] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setError(null)

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.")
      setLoading(false)
      return
    }

    try {
      const user = await signUpWithEmail(formData.email, formData.password, formData.name)
      setUserId(user.uid)
      setStep("genres")
    } catch (err) {
      console.error("Signup error:", err)
      setError("Couldn't create your account. That email may already be in use.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    try {
      const user = await signInWithGoogle()
      // Desktop returns a user immediately; mobile/Kindle redirects and resumes
      // after reload. New users land on reading-level onboarding.
      if (user) router.push("/reading-level")
    } catch (err) {
      console.error("Google signup error:", err)
      setError("Google sign-in failed. Please try again.")
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
    setError(null)

    if (!userId) {
      setError("Your session expired. Please sign up again.")
      setLoading(false)
      return
    }

    try {
      await updateDoc(doc(db, "users", userId), {
        genrePreferences: selectedGenres,
        lastBookRead: lastBook,
      })
      // New users continue to reading-level onboarding before the dashboard.
      router.push("/reading-level")
    } catch (err) {
      console.error("Genre submission error:", err)
      setError("Something went wrong saving your preferences. Please try again.")
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
            {error && (
              <div className="mb-4 px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm max-w-md text-center">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleGoogle}
              className="mb-4 w-full max-w-md flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors min-h-[48px]"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Continue with Google
            </button>
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
