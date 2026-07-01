"use client"
import { useState, type ChangeEvent, type FormEvent } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signUpWithEmail, signInWithGoogle } from "@/lib/firebase/auth"
import { db } from "@/lib/firebase/config"
import { doc, updateDoc } from "firebase/firestore"
import { AnimatedForm } from "@/components/auth/modern-animated-sign-in"
import { BackButton } from "@/components/back-button"

type FormData = {
  name: string
  email: string
  password: string
}

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
  const [formData, setFormData] = useState<FormData>({ name: "", email: "", password: "" })
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [lastBook, setLastBook] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goToSignIn = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    router.push("/login")
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>, name: keyof FormData) => {
    setFormData((prev) => ({ ...prev, [name]: event.target.value }))
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
      // New users pick their first book next (Step 1); reading level is Step 2.
      // Mobile/Kindle redirects and resumes after reload.
      if (user) router.push("/search")
    } catch (err) {
      console.error("Google signup error:", err)
      setError("Google sign-in failed. Please try again.")
    }
  }

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre)
      if (prev.length < 3) return [...prev, genre]
      return prev
    })
  }

  const handleGenreSubmit = async () => {
    setError(null)
    if (selectedGenres.length !== 3) {
      setError("Please select exactly 3 genres.")
      return
    }
    if (!lastBook.trim()) {
      setError("Please enter the last book you read.")
      return
    }
    if (!userId) {
      setError("Your session expired. Please sign up again.")
      return
    }

    setLoading(true)
    try {
      await updateDoc(doc(db, "users", userId), {
        genrePreferences: selectedGenres,
        lastBookRead: lastBook,
      })
      // Onboarding done — go pick the first book (Step 1).
      router.push("/search")
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
        type: "text" as const,
        placeholder: "Enter your full name",
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "name"),
      },
      {
        label: "Email",
        required: true,
        type: "email" as const,
        placeholder: "Enter your email address",
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "email"),
      },
      {
        label: "Password",
        required: true,
        type: "password" as const,
        placeholder: "Create a strong password",
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "password"),
      },
    ],
    submitButton: loading ? "Creating account..." : "Create Account",
    textVariantButton: "Already have an account? Login",
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center bg-[hsl(222,94%,5%)] px-4 py-10">
      <div className="absolute left-4 top-4 z-10">
        <BackButton to="/" label="Back to home" />
      </div>
      {step === "signup" ? (
        <div className="flex w-full max-w-md flex-col items-center">
          <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={110} height={110} className="mb-6" priority />

          {error && (
            <div className="mb-4 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <AnimatedForm
            {...formFields}
            fieldPerRow={1}
            onSubmit={handleSubmit}
            goTo={goToSignIn}
            googleLogin="Sign up with Google"
            onGoogleClick={handleGoogle}
          />
        </div>
      ) : (
        <div className="w-full max-w-2xl">
          <h2 className="mb-2 text-3xl font-bold text-white">Pick 3 genres you love</h2>
          <p className="mb-8 text-gray-400">Help us personalize your reading experience</p>

          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            {AVAILABLE_GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreToggle(genre)}
                disabled={!selectedGenres.includes(genre) && selectedGenres.length >= 3}
                className={`min-h-[48px] rounded-lg border-2 px-4 py-3 font-medium transition-all ${
                  selectedGenres.includes(genre)
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-[hsl(217,32.6%,17.5%)] bg-[hsl(219,63%,16%)] text-gray-300 hover:border-cyan-500/50"
                } ${!selectedGenres.includes(genre) && selectedGenres.length >= 3 ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {genre}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label htmlFor="lastBook" className="mb-2 block font-medium text-gray-200">
              Last book you read?
            </label>
            <input
              type="text"
              id="lastBook"
              value={lastBook}
              onChange={(e) => setLastBook(e.target.value)}
              placeholder="Enter the title of the last book you read"
              className="min-h-[48px] w-full rounded-lg border-2 border-[hsl(217,32.6%,17.5%)] bg-[hsl(219,63%,16%)] px-4 py-3 text-base text-white placeholder:text-gray-500 transition-colors focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="mb-4 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleGenreSubmit}
            disabled={loading || selectedGenres.length !== 3 || !lastBook.trim()}
            className="min-h-[48px] w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-medium text-white shadow-lg transition-all hover:shadow-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Setting up your account..." : "Continue →"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-400">{selectedGenres.length}/3 genres selected</p>
        </div>
      )}
    </section>
  )
}
