import { NextResponse } from "next/server"

// Course generation is being rebuilt on Google Gemini Flash (Phase 4).
// The previous implementation (OpenAI GPT-4o + DALL-E + Supabase) was removed
// during the Firebase migration. The new version will produce all 7 days,
// flashcards, and template questions in one structured Gemini call and write
// them to Firestore. Until then this endpoint is intentionally disabled.
export async function POST() {
  return NextResponse.json(
    { error: "Course generation is being rebuilt on Gemini (Phase 4) and is not yet available." },
    { status: 501 },
  )
}
