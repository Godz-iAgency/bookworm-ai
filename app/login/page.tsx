"use client"
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import type React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { demoLogin } from "@/lib/demo-auth"
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
    email: "demo@bookworm.ai",
    password: "demo123",
  })
  const [loading, setLoading] = useState(false)

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
    // Validate data and submit to API

    if (demoLogin(formData.email, formData.password)) {
      // Handle success
      router.push("/dashboard")
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      alert("Please use demo credentials: demo@bookworm.ai / demo123")
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        alert(`Login failed: ${error.message}`)
      } else {
        router.push("/dashboard")
      }
    } catch (error) {
      console.error("[v0] Login error:", error)
      alert("An error occurred during login. Please try again.")
    } finally {
      setLoading(false)
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
        <div className="mb-4 px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm max-w-md text-center">
          Demo credentials prefilled: demo@bookworm.ai / demo123
        </div>
        <AuthTabs formFields={formFields} goTo={goToSignUp} handleSubmit={handleSubmit} />
      </span>
    </section>
  )
}
