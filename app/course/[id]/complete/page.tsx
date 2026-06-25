"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Day-7 completion + Amazon affiliate flow will be rebuilt inside the dashboard
// (Phase 7). This old Supabase-backed completion page has been retired.
export default function CourseCompleteRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard")
  }, [router])
  return null
}
