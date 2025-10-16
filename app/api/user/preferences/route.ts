import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { genres, lastRead } = await req.json()

    if (!genres || !lastRead) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase.from("user_preferences").upsert({
      user_id: user.id,
      genres,
      last_read: lastRead,
    })

    if (error) {
      console.error("[v0] Preferences update error:", error)
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Preferences update error:", error)
    return NextResponse.json({ error: error.message || "Failed to update preferences" }, { status: 500 })
  }
}
