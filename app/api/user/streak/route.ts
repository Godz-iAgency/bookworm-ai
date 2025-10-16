import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { streakCount } = await req.json()

    const { error } = await supabase
      .from("users")
      .update({
        streak_count: streakCount,
        last_login: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (error) {
      console.error("[v0] Streak update error:", error)
      return NextResponse.json({ error: "Failed to update streak" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Streak update error:", error)
    return NextResponse.json({ error: "Failed to update streak" }, { status: 500 })
  }
}
