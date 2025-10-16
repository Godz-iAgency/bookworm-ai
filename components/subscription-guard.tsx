"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isDemoMode, getDemoUser } from "@/lib/demo-auth"

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checkSubscription() {
      if (isDemoMode()) {
        const demoUser = getDemoUser()
        if (demoUser) {
          setHasAccess(true)
          setIsChecking(false)
          return
        }
      }

      const supabase = createClient()
      if (!supabase) {
        console.log("[v0] Supabase not configured, redirecting to login")
        router.push("/login")
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      const response = await fetch("/api/user/subscription")
      const data = await response.json()

      if (data.hasAccess) {
        setHasAccess(true)
      } else {
        router.push("/pricing")
      }

      setIsChecking(false)
    }

    checkSubscription()
  }, [router])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#FFFDD0] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#008080] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking subscription...</p>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return null
  }

  return <>{children}</>
}
