import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry, volumesUrl, normalizeCover } from "@/lib/google-books";

/**
 * Just the cover art for one known title, for the Personal Development
 * shelves. Separate from /api/books/search because the need is different:
 * search resolves an unknown query typed by the reader into a book, whereas
 * here the book is already known and only its artwork is missing.
 *
 * A pillar page shows 25 of these at once, so the result is cached in module
 * scope. That survives for the life of a warm serverless instance, which
 * turns repeat visits to the same shelf into no outbound calls at all. The
 * client caches too (see components/book-cover.tsx); this second layer is
 * what stops a cold cache from costing 25 lookups per visitor.
 */
const cache = new Map<string, string | null>();

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  const author = req.nextUrl.searchParams.get("author") ?? "";

  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const key = `${title}|${author}`.toLowerCase();
  if (cache.has(key)) {
    return NextResponse.json({ coverUrl: cache.get(key) ?? null, cached: true });
  }

  // Field-qualified so a title that is also a common phrase ("Influence",
  // "Grit", "Drive") returns the actual book rather than whatever else
  // matches those words.
  const query = author ? `intitle:${title}+inauthor:${author}` : `intitle:${title}`;

  try {
    const res = await fetchWithRetry(volumesUrl(query));
    if (!res.ok) {
      return NextResponse.json({ coverUrl: null });
    }
    const data = await res.json();
    const cover = normalizeCover(data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail);
    // Cached either way: a book with no artwork shouldn't be looked up again
    // on every visit just to get the same empty answer.
    cache.set(key, cover);
    return NextResponse.json({ coverUrl: cover });
  } catch (err: any) {
    console.error("Cover lookup failed:", title, err?.message);
    // Not cached: a transient failure should be retried on the next visit.
    return NextResponse.json({ coverUrl: null });
  }
}
