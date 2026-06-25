import { NextResponse } from "next/server"

// Payments are DEFERRED — see app/api/stripe/checkout/route.ts. This webhook is
// intentionally inert until the payments phase. Returns 200 so any test events
// are acknowledged without error. The previous Supabase handler is in git history.
export async function POST() {
  return NextResponse.json({ received: true, handled: false })
}
