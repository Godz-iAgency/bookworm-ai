import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { message, courseTitle, currentLesson } = await req.json()

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `You are a helpful AI tutor for the book "${courseTitle}". 
      
Current lesson context: ${currentLesson.substring(0, 500)}...

User question: ${message}

Provide a helpful, concise answer that relates to the book and the current lesson. Be encouraging and educational.`,
      maxOutputTokens: 500,
    })

    return Response.json({ response: text })
  } catch (error) {
    console.error("[v0] Chat error:", error)
    return Response.json({ error: "Failed to generate response" }, { status: 500 })
  }
}
