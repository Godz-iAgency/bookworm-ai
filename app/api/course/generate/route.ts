import { generateObject } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

const courseDaySchema = z.object({
  day: z.number(),
  principle: z.string(),
  title: z.string(),
  lesson: z.string(),
  glossary: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    }),
  ),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctAnswer: z.number(),
    }),
  ),
})

const courseSchema = z.object({
  days: z.array(courseDaySchema),
})

export async function POST(req: Request) {
  try {
    const { title, author } = await req.json()

    if (!title || !author) {
      return Response.json({ error: "Missing title or author" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Generate course content using OpenAI
    const { object: courseContent } = await generateObject({
      model: "openai/gpt-4o",
      schema: courseSchema,
      prompt: `Create a 7-day learning course for the book "${title}" by ${author}.

For each day:
- Extract one key principle or lesson from the book
- Write a 1500-word detailed lesson explaining the principle with examples and practical applications
- Include 5-7 important terms with definitions for a glossary
- Create 3 multiple-choice quiz questions to test understanding

Make the content engaging, practical, and actionable. Focus on helping readers apply the book's wisdom to their lives.

Return exactly 7 days of content.`,
      maxOutputTokens: 8000,
    })

    // Generate DALL-E images for each day
    const daysWithImages = await Promise.all(
      courseContent.days.map(async (day, index) => {
        try {
          const imagePrompt = `Minimalist watercolor illustration with teal and orange gradient colors. Abstract representation of: ${day.principle}. Clean, modern, educational style. No text.`

          const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: imagePrompt,
              n: 1,
              size: "1024x1024",
              quality: "standard",
            }),
          })

          const imageData = await imageResponse.json()
          const imageUrl = imageData.data?.[0]?.url || ""

          return {
            ...day,
            imageUrl,
          }
        } catch (error) {
          console.error(`[v0] Error generating image for day ${index + 1}:`, error)
          return {
            ...day,
            imageUrl: `/placeholder.svg?height=400&width=600&query=${encodeURIComponent(day.principle)}`,
          }
        }
      }),
    )

    const { data: course, error: dbError } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        book_title: title,
        book_author: author,
        days: daysWithImages,
      })
      .select()
      .single()

    if (dbError) {
      console.error("[v0] Database error:", dbError)
      return Response.json({ error: "Failed to save course" }, { status: 500 })
    }

    return Response.json({ courseId: course.id })
  } catch (error) {
    console.error("[v0] Course generation error:", error)
    return Response.json({ error: "Failed to generate course" }, { status: 500 })
  }
}
