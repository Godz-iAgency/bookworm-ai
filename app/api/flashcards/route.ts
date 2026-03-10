import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("API Key missing: GEMINI_API_KEY is not defined in environment variables.");
      return NextResponse.json({ error: "Gemini API Key is missing." }, { status: 500 });
    }

    const { title, author, readingLevel } = await req.json();

    const prompt = `Generate 15 flashcards for '${title}' by '${author}' at ${readingLevel} level. Each card has a clear question and a concise answer based on the book's core principles. Return ONLY a valid JSON array with 'question' and 'answer' fields. No extra text.`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gemini API Error:", errorText);
      return NextResponse.json({ error: `Gemini API failed: ${res.statusText}` }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error("Gemini API returned empty response.");
      return NextResponse.json({ error: "Empty response from Gemini." }, { status: 500 });
    }

    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedCards = JSON.parse(cleanJson);

    return NextResponse.json({ cards: parsedCards });
  } catch (error: any) {
    console.error("Server Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
