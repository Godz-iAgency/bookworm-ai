import { NextResponse, type NextRequest } from "next/server"

// Auth is handled client-side via Firebase (see context/AuthContext.tsx).
// Firebase persists its session in IndexedDB rather than cookies, so the
// middleware cannot read the auth state here. Protection for /dashboard,
// /course/*, /library and /settings is therefore enforced client-side in
// those routes (a logged-out user is redirected to /auth).
//
// (A later phase may introduce a Firebase session cookie so this middleware
// can block protected routes at the edge before the page renders.)
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
