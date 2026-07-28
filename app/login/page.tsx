"use client"
import { useState, useEffect, type ChangeEvent, type FormEvent } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signInWithEmail, signInWithGoogle, friendlyAuthError } from "@/lib/firebase/auth"
import { useAuth } from "@/context/AuthContext"
import { AnimatedForm } from "@/components/auth/modern-animated-sign-in"
import { BackButton } from "@/components/back-button"

type FormData = {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const { user, redirectChecked, redirectIsNew, redirectError } = useAuth()
  const [formData, setFormData] = useState<FormData>({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mobile Google sign-in returns here after a full page reload, so the
  // outcome arrives via AuthContext rather than from handleGoogle. Wait for
  // redirectChecked so a brand-new account still lands on onboarding.
  useEffect(() => {
    if (!redirectChecked || !user) return
    router.push(redirectIsNew ? "/onboarding" : "/dashboard")
  }, [redirectChecked, user, redirectIsNew, router])

  useEffect(() => {
    if (redirectError) setError(redirectError)
  }, [redirectError])

  const goToSignUp = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    router.push("/signup")
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>, name: keyof FormData) => {
    setFormData((prev) => ({ ...prev, [name]: event.target.value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signInWithEmail(formData.email, formData.password)
      router.push("/dashboard")
    } catch (err) {
      console.error("Login error:", err)
      setError("That email or password didn't work. Please try again.")
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    try {
      const { user, isNew } = await signInWithGoogle()
      // If Google creates a brand-new account here, route through onboarding;
      // an existing user goes to their dashboard. Desktop returns a user
      // immediately; mobile/Kindle redirects and resumes after the page reloads.
      if (user) router.push(isNew ? "/onboarding" : "/dashboard")
    } catch (err) {
      console.error("Google login error:", err)
      setError(friendlyAuthError(err))
    }
  }

  const formFields = {
    header: "Welcome back",
    subHeader: "Login to your account",
    fields: [
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
        placeholder: "Enter your password",
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "password"),
      },
    ],
    submitButton: loading ? "Logging in..." : "Login",
    textVariantButton: "Don't have an account? Sign up",
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center bg-[hsl(222,94%,5%)] px-4 py-10">
      <div className="absolute left-4 top-4 z-10">
        <BackButton to="/" label="Back to home" />
      </div>
      <div className="flex w-full max-w-md flex-col items-center">
        <Image
          src="/bookworm-logo.png"
          alt="Bookworm.AI"
          width={400}
          height={400}
          // Rendered at 110px the wordmark was unreadable on a phone. Sized in
          // CSS (not the intrinsic width) so it stays sharp and still leaves
          // room for the form on a short screen.
          className="mb-5 h-auto w-56 drop-shadow-2xl sm:w-64"
          priority
        />

        {error && (
          <div className="mb-4 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-3 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        <AnimatedForm
          {...formFields}
          fieldPerRow={1}
          onSubmit={handleSubmit}
          goTo={goToSignUp}
          googleLogin="Login with Google"
          onGoogleClick={handleGoogle}
        />
      </div>
    </section>
  )
}
