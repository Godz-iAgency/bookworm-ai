import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const url = apiKey
    ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&key=${apiKey}`
    : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`;

  const res = await fetch(url);
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
      coverUrl: v.imageLinks?.thumbnail?.replace("http:", "https:") || "/placeholder.jpg",
      description: v.description ? v.description.substring(0, 150) + "..." : "No description available.",
    },
  });
}
