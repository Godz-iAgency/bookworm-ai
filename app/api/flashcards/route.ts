import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { course_id, quote, context } = body

    if (!course_id || !quote) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: flashcard, error } = await supabase
      .from("flashcards")
      .insert({
        user_id: user.id,
        course_id,
        quote,
        context: context || "",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating flashcard:", error)
      return NextResponse.json({ error: "Failed to create flashcard" }, { status: 500 })
    }

    return NextResponse.json({ success: true, flashcard })
  } catch (error) {
    console.error("[v0] Error creating flashcard:", error)
    return NextResponse.json({ error: "Failed to create flashcard" }, { status: 500 })
  }
}
