"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import { Trophy, BookOpen, Heart } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export default function CourseCompletePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const [flashcardCount, setFlashcardCount] = useState(0)

  useEffect(() => {
    loadFlashcards()
  }, [])

  const loadFlashcards = async () => {
    const supabase = getSupabaseBrowserClient()
    const { count } = await supabase
      .from("flashcards")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)

    setFlashcardCount(count || 0)
  }

  return (
    <div className="min-h-screen bg-[#FFFDD0] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%20Oct%205%2C%202025%2C%2010_40_41%20PM-H6XfD24mrebcr7PyZI2hKrfdpYpiFW.png"
            alt="Bookworm.AI Logo"
            width={120}
            height={120}
            className="mx-auto mb-6"
          />
          <Trophy className="w-24 h-24 text-[#D4AF37] mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-[#008080] mb-4">Course Complete!</h1>
          <p className="text-xl text-gray-700">Congratulations on completing your 7-day learning journey!</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="text-center p-6 bg-[#FFFDD0] rounded-xl">
              <BookOpen className="w-12 h-12 text-[#008080] mx-auto mb-2" />
              <p className="text-3xl font-bold text-[#008080]">7</p>
              <p className="text-gray-700">Days Completed</p>
            </div>
            <div className="text-center p-6 bg-[#FFFDD0] rounded-xl">
              <Heart className="w-12 h-12 text-[#CC5500] mx-auto mb-2" />
              <p className="text-3xl font-bold text-[#CC5500]">{flashcardCount}</p>
              <p className="text-gray-700">Quotes Saved</p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-[#008080] text-white py-4 rounded-xl font-bold hover:bg-[#006666] transition-all"
            >
              Start Another Course
            </button>
            <button
              onClick={() => router.push(`/course/${courseId}`)}
              className="w-full bg-white text-[#008080] border-2 border-[#008080] py-4 rounded-xl font-bold hover:bg-gray-50 transition-all"
            >
              Review Course
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600">Your flashcards have been saved for future review!</p>
      </div>
    </div>
  )
}
