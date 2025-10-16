"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Loader2 } from "lucide-react"

export default function GenerateCoursePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState("Analyzing book...")

  const title = searchParams.get("title")
  const author = searchParams.get("author")

  useEffect(() => {
    if (!title || !author) {
      router.push("/dashboard")
      return
    }

    generateCourse()
  }, [title, author])

  const generateCourse = async () => {
    try {
      setCurrentStep("Extracting key principles...")
      setProgress(20)

      const response = await fetch("/api/course/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate course")
      }

      const data = await response.json()

      setProgress(100)
      setCurrentStep("Course ready!")

      setTimeout(() => {
        router.push(`/course/${data.courseId}`)
      }, 1000)
    } catch (error) {
      console.error("[v0] Course generation error:", error)
      alert("Failed to generate course. Please try again.")
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFDD0] flex items-center justify-center">
      <div className="max-w-2xl w-full px-8">
        <div className="text-center mb-8">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Oct%205%2C%202025%2C%2010_40_41%20PM-H6XfD24mrebcr7PyZI2hKrfdpYpiFW.png"
            alt="Bookworm.AI Logo"
            width={100}
            height={100}
            className="mx-auto mb-6"
          />
          <h1 className="text-3xl font-bold text-[#008080] mb-2">Creating Your Course</h1>
          <p className="text-xl text-gray-700 mb-2">
            {title} by {author}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <Loader2 className="w-12 h-12 text-[#008080] animate-spin" />
          </div>

          <p className="text-center text-lg text-[#008080] font-medium mb-6">{currentStep}</p>

          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#008080] to-[#CC5500] h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-center text-gray-600 mt-4">{progress}% complete</p>
        </div>

        <p className="text-center text-gray-600 mt-6">
          This may take a minute as we craft your personalized learning journey...
        </p>
      </div>
    </div>
  )
}
