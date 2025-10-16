// Demo authentication system for testing without Supabase
// This will be replaced with real Supabase auth later

const DEMO_USER = {
  id: "demo-user-123",
  email: "demo@bookworm.ai",
  password: "demo123",
  name: "Demo User",
  genres: ["Fiction", "Science Fiction", "Philosophy"],
  last_read: "The Hitchhiker's Guide to the Galaxy",
  subscription_status: "trialing",
  trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  streak: 3,
}

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem("demo_mode") === "true"
}

export function setDemoMode(enabled: boolean) {
  if (typeof window === "undefined") return
  if (enabled) {
    localStorage.setItem("demo_mode", "true")
    localStorage.setItem("demo_user", JSON.stringify(DEMO_USER))
  } else {
    localStorage.removeItem("demo_mode")
    localStorage.removeItem("demo_user")
    localStorage.removeItem("demo_courses")
  }
}

export function getDemoUser() {
  if (typeof window === "undefined") return null
  const userStr = localStorage.getItem("demo_user")
  return userStr ? JSON.parse(userStr) : null
}

export function demoLogin(email: string, password: string): boolean {
  if (email === DEMO_USER.email && password === DEMO_USER.password) {
    setDemoMode(true)
    return true
  }
  return false
}

export function demoSignup(name: string, email: string, password: string): boolean {
  // For demo, accept any credentials
  const newUser = { ...DEMO_USER, name, email }
  localStorage.setItem("demo_mode", "true")
  localStorage.setItem("demo_user", JSON.stringify(newUser))
  return true
}

export function demoLogout() {
  setDemoMode(false)
}

export function saveDemoCourse(course: any) {
  if (typeof window === "undefined") return
  const coursesStr = localStorage.getItem("demo_courses")
  const courses = coursesStr ? JSON.parse(coursesStr) : []
  courses.push(course)
  localStorage.setItem("demo_courses", JSON.stringify(courses))
}

export function getDemoCourses() {
  if (typeof window === "undefined") return []
  const coursesStr = localStorage.getItem("demo_courses")
  return coursesStr ? JSON.parse(coursesStr) : []
}
