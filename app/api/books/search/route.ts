import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry, volumesUrl, normalizeCover } from "@/lib/google-books";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetchWithRetry(volumesUrl(q));
  } catch (err: any) {
    console.error("Google Books search failed after retries:", err?.message);
    return NextResponse.json({ error: "Google Books request failed" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "Google Books request failed" },
      { status: res.status }
    );
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    return NextResponse.json({ book: null });
  }

  const v = data.items[0].volumeInfo;
  return NextResponse.json({
    book: {
      title: v.title || "Unknown Title",
      author: v.authors?.[0] || "Unknown Author",
      coverUrl: normalizeCover(v.imageLinks?.thumbnail) || "/placeholder.jpg",
      description: v.description ? v.description.substring(0, 150) + "..." : "No description available.",
    },
  });
}
