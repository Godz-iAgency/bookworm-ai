import { NextResponse } from "next/server";
import { generateVisionJson } from "@/lib/generate";

// Matches the other Gemini-calling routes. A vision call is normally fast,
// but 3 retries with backoff against a busy model can legitimately run long,
// and on Vercel this is a hard kill, not just a client-side timeout.
export const maxDuration = 60;

const SYSTEM = `You read book covers from photos. You ALWAYS return valid JSON matching the requested schema exactly, no commentary, no markdown fences.`;

const PROMPT = `This photo shows a book, most likely its front cover or spine.

If you can clearly identify a real book:
Return {"confident": true, "title": "...", "author": "..."}

- "title": the book's main title only, the way someone would actually say it aloud or type it into a search box. Leave out any subtitle or tagline, even if it is printed large on the cover. "Never Split the Difference: Negotiating As If Your Life Depended On It" becomes "Never Split the Difference".
- "author": the primary author's name only, in normal Title Case, not however it happens to be printed. Leave out "with [co-writer]", "foreword by", translators, or illustrators unless there is no primary author without them.

If the image is blurry, cropped, not actually a book, or you cannot confidently read a title:
Return {"confident": false, "title": "", "author": ""}

Do not guess a plausible-sounding book that is not what is actually shown. An honest "confident: false" is far better than a wrong title.`;

/**
 * Reads a photographed book cover and returns its title and author, so the
 * "+" flow can start from a photo instead of typed text. Deliberately narrow:
 * it does not look up the book itself. The client feeds what comes back here
 * through the same Google Books search a typed title goes through, which is
 * what lands it on the one confirmation card the rest of the app already has.
 */
export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "Missing image." }, { status: 400 });
    }

    const parsed = await generateVisionJson(
      PROMPT,
      SYSTEM,
      { mimeType: typeof mimeType === "string" ? mimeType : "image/jpeg", data: imageBase64 },
      256
    );

    if (parsed?.confident !== true || typeof parsed.title !== "string" || !parsed.title.trim()) {
      return NextResponse.json({ book: null });
    }

    return NextResponse.json({
      book: {
        title: parsed.title.trim(),
        author: typeof parsed.author === "string" ? parsed.author.trim() : "",
      },
    });
  } catch (error: any) {
    console.error("Cover scan failed:", error);
    return NextResponse.json(
      { error: error.message || "Could not read that cover." },
      { status: 500 }
    );
  }
}
