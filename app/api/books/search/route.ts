import { NextRequest, NextResponse } from "next/server";

const ATTEMPTS = 3;
const TIMEOUT_MS = 8000;

/**
 * One call to Google Books, with a timeout so a hung request doesn't leave
 * the reader waiting indefinitely.
 */
async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google Books occasionally hiccups (a transient 5xx, a rate-limit 429, a
 * timed-out connection) on a single call. Readers were seeing "An error
 * occurred while searching" on the first try and getting a good result by
 * hitting Search again themselves — this is that same retry, done here
 * instead of asking them to notice and do it manually. A short backoff
 * between attempts gives a rate limit a moment to clear.
 */
async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const res = await fetchOnce(url);
      if (res.ok) return res;
      // 404 (no matches) isn't transient — retrying won't change it.
      if (res.status === 404) return res;
      lastErr = new Error(`Google Books returned ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Google Books request failed");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const url = apiKey
    ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&key=${apiKey}`
    : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`;

  let res: Response;
  try {
    res = await fetchWithRetry(url);
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
      coverUrl: v.imageLinks?.thumbnail?.replace("http:", "https:") || "/placeholder.jpg",
      description: v.description ? v.description.substring(0, 150) + "..." : "No description available.",
    },
  });
}
