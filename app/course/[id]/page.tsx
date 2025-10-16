"use client"
import { useEffect, useState } from "react"
import type React from "react"
import { useRouter, useParams } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import Image from "next/image"
import { ChevronLeft, ChevronRight, MessageCircle, Headphones, Heart, X } from "lucide-react"

type GlossaryTerm = {
  term: string
  definition: string
}

type QuizQuestion = {
  question: string
  options: string[]
  correctAnswer: number
}

type CourseDay = {
  day: number
  principle: string
  title: string
  lesson: string
  imageUrl: string
  glossary: GlossaryTerm[]
  quiz: QuizQuestion[]
}

type Course = {
  id: string
  title: string
  author: string
  days: CourseDay[]
  current_day: number
  completed: boolean
}

export default function CoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const supabase = getSupabaseBrowserClient()

  const [course, setCourse] = useState<Course | null>(null)
  const [currentDay, setCurrentDay] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([])
  const [isReading, setIsReading] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [showGlossary, setShowGlossary] = useState(false)
  const [glossaryTerm, setGlossaryTerm] = useState<GlossaryTerm | null>(null)

  useEffect(() => {
    checkAuthAndLoadCourse()
  }, [courseId])

  const checkAuthAndLoadCourse = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      return
    }

    loadCourse()
  }

  const loadCourse = async () => {
    try {
      const response = await fetch(`/api/course/${courseId}`)

      if (!response.ok) {
        console.error("[v0] Error loading course")
        router.push("/dashboard")
        return
      }

      const data = await response.json()
      setCourse(data)
      setCurrentDay(data.current_day - 1)
    } catch (error) {
      console.error("[v0] Error:", error)
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const handleNextDay = async () => {
    if (!course) return

    if (currentDay < course.days.length - 1) {
      const nextDay = currentDay + 1
      setCurrentDay(nextDay)
      setShowQuiz(false)
      setQuizSubmitted(false)
      setQuizAnswers([])

      await fetch(`/api/course/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_day: nextDay + 1 }),
      })
    } else {
      await fetch(`/api/course/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      })
      router.push(`/course/${courseId}/complete`)
    }
  }

  const handlePrevDay = () => {
    if (currentDay > 0) {
      setCurrentDay(currentDay - 1)
      setShowQuiz(false)
      setQuizSubmitted(false)
      setQuizAnswers([])
    }
  }

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...quizAnswers]
    newAnswers[questionIndex] = answerIndex
    setQuizAnswers(newAnswers)
  }

  const handleQuizSubmit = () => {
    setQuizSubmitted(true)
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatMessage.trim() || !course) return

    const userMessage = chatMessage
    setChatMessage("")
    setChatHistory([...chatHistory, { role: "user", content: userMessage }])

    try {
      const response = await fetch("/api/course/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          courseTitle: course.title,
          currentLesson: course.days[currentDay].lesson,
        }),
      })

      const data = await response.json()
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.response }])
    } catch (error) {
      console.error("[v0] Chat error:", error)
    }
  }

  const handleReadAloud = () => {
    if (!course) return

    if (isReading) {
      window.speechSynthesis.cancel()
      setIsReading(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(course.days[currentDay].lesson)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onend = () => {
      setIsReading(false)
    }

    window.speechSynthesis.speak(utterance)
    setIsReading(true)
  }

  const handleSaveQuote = async () => {
    if (!selectedText || !course) return

    try {
      await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          quote: selectedText,
          context: course.days[currentDay].lesson.substring(0, 200),
        }),
      })

      alert("Quote saved to flashcards!")
      setSelectedText("")
    } catch (error) {
      console.error("[v0] Error saving quote:", error)
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (text) {
      setSelectedText(text)
    }
  }

  const checkGlossaryTerm = (word: string) => {
    if (!course) return

    const term = course.days[currentDay].glossary.find(
      (g) => g.term.toLowerCase() === word.toLowerCase().replace(/[.,!?;:]/g, ""),
    )

    if (term) {
      setGlossaryTerm(term)
      setShowGlossary(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDD0] flex items-center justify-center">
        <div className="text-[#008080] text-xl">Loading course...</div>
      </div>
    )
  }

  if (!course) {
    return null
  }

  const day = course.days[currentDay]

  return (
    <div className="min-h-screen bg-[#FFFDD0]">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push("/dashboard")} className="text-[#008080] hover:text-[#006666]">
              ← Back to Dashboard
            </button>
            <div className="flex-1 mx-8">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-[#008080] to-[#CC5500] h-full rounded-full transition-all"
                  style={{ width: `${((currentDay + 1) / course.days.length) * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-600 mt-1">
                Day {currentDay + 1} of {course.days.length}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReadAloud}
                className={`p-2 rounded-full transition-all ${
                  isReading ? "bg-[#CC5500] text-white" : "bg-[#008080] text-white hover:bg-[#006666]"
                }`}
                title="Read aloud"
              >
                <Headphones className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowChat(!showChat)}
                className="p-2 rounded-full bg-[#008080] text-white hover:bg-[#006666] transition-all"
                title="Ask AI"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Image */}
          <div className="relative h-64 bg-gradient-to-br from-[#008080] to-[#CC5500]">
            <Image src={day.imageUrl || "/placeholder.svg"} alt={day.principle} fill className="object-cover" />
          </div>

          {/* Content */}
          <div className="p-8">
            <h1 className="text-3xl font-bold text-[#008080] mb-2">
              Day {day.day}: {day.principle}
            </h1>
            <h2 className="text-xl text-gray-700 mb-6">{day.title}</h2>

            <div
              className="prose prose-lg max-w-none text-gray-800 leading-relaxed mb-8"
              onMouseUp={handleTextSelection}
              onClick={(e) => {
                const target = e.target as HTMLElement
                if (target.tagName === "SPAN") {
                  checkGlossaryTerm(target.textContent || "")
                }
              }}
            >
              {day.lesson.split(" ").map((word, index) => {
                const isGlossaryTerm = day.glossary.some(
                  (g) => g.term.toLowerCase() === word.toLowerCase().replace(/[.,!?;:]/g, ""),
                )
                return isGlossaryTerm ? (
                  <span
                    key={index}
                    className="text-[#008080] font-semibold cursor-pointer hover:underline"
                    onClick={() => checkGlossaryTerm(word)}
                  >
                    {word}{" "}
                  </span>
                ) : (
                  <span key={index}>{word} </span>
                )
              })}
            </div>

            {selectedText && (
              <div className="mb-6 p-4 bg-[#FFFDD0] rounded-lg flex items-center justify-between">
                <p className="text-sm text-gray-700 flex-1">"{selectedText}"</p>
                <button
                  onClick={handleSaveQuote}
                  className="ml-4 flex items-center gap-2 px-4 py-2 bg-[#CC5500] text-white rounded-lg hover:bg-[#b34900] transition-all"
                >
                  <Heart className="w-4 h-4" />
                  Save Quote
                </button>
              </div>
            )}

            {!showQuiz ? (
              <button
                onClick={() => setShowQuiz(true)}
                className="w-full bg-[#008080] text-white py-4 rounded-xl font-bold hover:bg-[#006666] transition-all"
              >
                Take Quiz →
              </button>
            ) : (
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-2xl font-bold text-[#008080] mb-6">Quiz Time!</h3>
                {day.quiz.map((q, qIndex) => (
                  <div key={qIndex} className="mb-6">
                    <p className="font-semibold text-gray-800 mb-3">
                      {qIndex + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((option, oIndex) => (
                        <button
                          key={oIndex}
                          onClick={() => handleQuizAnswer(qIndex, oIndex)}
                          disabled={quizSubmitted}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                            quizSubmitted
                              ? oIndex === q.correctAnswer
                                ? "bg-green-100 border-green-500"
                                : quizAnswers[qIndex] === oIndex
                                  ? "bg-red-100 border-red-500"
                                  : "bg-gray-50 border-gray-200"
                              : quizAnswers[qIndex] === oIndex
                                ? "bg-[#008080] text-white border-[#008080]"
                                : "bg-white border-gray-300 hover:border-[#008080]"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {!quizSubmitted ? (
                  <button
                    onClick={handleQuizSubmit}
                    disabled={quizAnswers.length !== day.quiz.length}
                    className="w-full bg-[#CC5500] text-white py-4 rounded-xl font-bold hover:bg-[#b34900] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <button
                    onClick={handleNextDay}
                    className="w-full bg-[#008080] text-white py-4 rounded-xl font-bold hover:bg-[#006666] transition-all"
                  >
                    {currentDay < course.days.length - 1 ? "Next Day →" : "Complete Course 🎉"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={handlePrevDay}
            disabled={currentDay === 0}
            className="flex items-center gap-2 px-6 py-3 bg-white text-[#008080] rounded-xl font-bold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous Day
          </button>
          <button
            onClick={handleNextDay}
            disabled={!quizSubmitted}
            className="flex items-center gap-2 px-6 py-3 bg-white text-[#008080] rounded-xl font-bold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Day
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </main>

      {/* Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-end p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[600px] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold text-[#008080]">Ask AI Anything</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg ${
                      msg.role === "user" ? "bg-[#008080] text-white" : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Ask about this lesson..."
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#008080] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#008080] text-white rounded-lg font-bold hover:bg-[#006666] transition-all"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Glossary Modal */}
      {showGlossary && glossaryTerm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowGlossary(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-2xl font-bold text-[#008080] mb-2">{glossaryTerm.term}</h3>
            <p className="text-gray-700">{glossaryTerm.definition}</p>
            <button
              onClick={() => setShowGlossary(false)}
              className="mt-4 w-full bg-[#008080] text-white py-2 rounded-lg hover:bg-[#006666] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
