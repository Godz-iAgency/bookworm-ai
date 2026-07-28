"use client"
import { useState, useEffect, type ChangeEvent, type FormEvent } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signUpWithEmail, signInWithGoogle, friendlyAuthError } from "@/lib/firebase/auth"
import { useAuth } from "@/context/AuthContext"
import { AnimatedForm } from "@/components/auth/modern-animated-sign-in"
import { BackButton } from "@/components/back-button"

type FormData = {
  name: string
  email: string
  password: string
}

export default function SignUpPage() {
  const router = useRouter()
  const { user, redirectChecked, redirectIsNew, redirectError } = useAuth()
  const [formData, setFormData] = useState<FormData>({ name: "", email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mobile Google sign-up returns here after a full page reload — see the
  // matching effect in app/login/page.tsx.
  useEffect(() => {
    if (!redirectChecked || !user) return
    router.push(redirectIsNew ? "/onboarding" : "/dashboard")
  }, [redirectChecked, user, redirectIsNew, router])

  useEffect(() => {
    if (redirectError) setError(redirectError)
  }, [redirectError])

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
      await signUpWithEmail(formData.email, formData.password, formData.name)
      // Brand-new account → onboarding (pick genres + last book) before search.
      router.push("/onboarding")
    } catch (err) {
      console.error("Signup error:", err)
      setError("Couldn't create your account. That email may already be in use.")
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    try {
      const { user, isNew } = await signInWithGoogle()
      // New Google accounts go through onboarding just like email signups;
      // an existing user who lands here goes straight to their dashboard.
      // Mobile/Kindle redirects and resumes after reload.
      if (user) router.push(isNew ? "/onboarding" : "/dashboard")
    } catch (err) {
      console.error("Google signup error:", err)
      setError(friendlyAuthError(err))
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
      <div className="flex w-full max-w-md flex-col items-center">
        <Image
          src="/bookworm-logo.png"
          alt="Bookworm.AI"
          width={400}
          height={400}
          // See app/login/page.tsx — 110px was unreadable on a phone.
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
          goTo={goToSignIn}
          googleLogin="Sign up with Google"
          onGoogleClick={handleGoogle}
        />
      </div>
    </section>
  )
}
