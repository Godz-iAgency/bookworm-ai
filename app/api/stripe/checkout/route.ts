import { NextResponse } from "next/server"

// Payments are DEFERRED. Stripe is intentionally left disconnected for now —
// everyone is on the free plan. The previous Supabase-coupled checkout logic
// was removed during the Firebase migration and lives in git history; it will
// be rebuilt in a dedicated payments phase. This stub keeps the route present
// but inert so the app builds cleanly.
export async function POST() {
  return NextResponse.json({ error: "Payments are not enabled yet." }, { status: 501 })
}
