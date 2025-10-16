import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ hasAccess: false }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("users")
      .select("subscription_status, created_at")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ hasAccess: false }, { status: 404 })
    }

    // Check if user is paid or within 7-day trial
    const createdAt = new Date(profile.created_at)
    const now = new Date()
    const daysSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

    const hasAccess =
      profile.subscription_status === "active" || (profile.subscription_status === "trial" && daysSinceSignup < 7)

    return NextResponse.json({ hasAccess })
  } catch (error) {
    console.error("[v0] Subscription check error:", error)
    return NextResponse.json({ hasAccess: false }, { status: 500 })
  }
}
