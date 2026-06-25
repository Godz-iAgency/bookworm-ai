"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// The course experience now lives in the /dashboard 3-tab interface (Phase 5),
// wired to Firestore. This old Supabase-backed standalone course viewer has
// been retired; redirect any old links to the dashboard.
export default function CourseRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard")
  }, [router])
  return null
}
