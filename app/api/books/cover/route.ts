import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry, volumesUrl, normalizeCover, titlesMatch } from "@/lib/google-books";

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
    // Several results rather than one, and then the first that is actually
    // this book. Google answers a miss with its next best guess rather than
    // with nothing, so taking item[0] on faith put a nursing exam prep cover
    // on "The Mind of Napoleon". Same single call either way.
    const res = await fetchWithRetry(volumesUrl(query, 5));
    if (!res.ok) {
      // fetchWithRetry only returns a non-ok response for a 404, which means
      // no matches: a real answer, and a cacheable one.
      cache.set(key, null);
      return NextResponse.json({ coverUrl: null });
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    const match = items.find(
      (item) =>
        titlesMatch(title, item?.volumeInfo?.title) &&
        item?.volumeInfo?.imageLinks?.thumbnail
    );
    const cover = normalizeCover(match?.volumeInfo?.imageLinks?.thumbnail);
    // Cached either way: a book with no artwork shouldn't be looked up again
    // on every visit just to get the same empty answer.
    cache.set(key, cover);
    return NextResponse.json({ coverUrl: cover });
  } catch (err: any) {
    console.error("Cover lookup failed:", title, err?.message);
    // Not cached, and flagged: this is "ask again later", not "this book has
    // no cover". Without the flag the client writes the empty answer into
    // localStorage and never asks again, so one rate-limited afternoon leaves
    // a book coverless on that device permanently.
    return NextResponse.json({ coverUrl: null, retry: true });
  }
}
