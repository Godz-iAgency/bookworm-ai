"use client"
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signInWithEmail, signInWithGoogle } from "@/lib/firebase/auth"
import { Ripple, AuthTabs, TechOrbitDisplay } from "@/components/auth/modern-animated-sign-in"

type FormData = {
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
    duration: 20,
    delay: 20,
    radius: 150,
    path: false,
    reverse: true,
  },
  {
    component: () => <div className="text-4xl">🎯</div>,
    className: "size-[40px] border-none bg-transparent",
    duration: 20,
    delay: 10,
    radius: 150,
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

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goToSignUp = (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    event.preventDefault()
    router.push("/signup")
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
      const user = await signInWithGoogle()
      // On desktop a user is returned immediately; on mobile/Kindle the call
      // redirects and routing resumes after the page reloads.
      if (user) router.push("/dashboard")
    } catch (err) {
      console.error("Google login error:", err)
      setError("Google sign-in failed. Please try again.")
    }
  }

  const formFields = {
    header: "Welcome back",
    subHeader: "Sign in to your account",
    fields: [
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
        placeholder: "Enter your password",
        value: formData.password,
        onChange: (event: ChangeEvent<HTMLInputElement>) => handleInputChange(event, "password"),
      },
    ],
    submitButton: loading ? "Signing in..." : "Sign in",
    textVariantButton: "Don't have an account? Sign up",
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

      {/* Right Side - Login Form */}
      <span className="w-1/2 min-h-screen flex flex-col justify-center items-center max-lg:w-full max-lg:px-[10%]">
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
        <AuthTabs formFields={formFields} goTo={goToSignUp} handleSubmit={handleSubmit} />
      </span>
    </section>
  )
}
