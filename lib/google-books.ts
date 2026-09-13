/**
 * Shared Google Books access for the search flow and the mastery cover
 * lookup. Server-only: both callers are API routes.
 */

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
export async function fetchWithRetry(url: string): Promise<Response> {
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

/** Volumes endpoint for a query, with the API key attached when one is set. */
export function volumesUrl(query: string, maxResults = 1): string {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const base = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
    query
  )}&maxResults=${maxResults}`;
  return apiKey ? `${base}&key=${apiKey}` : base;
}

/** Google serves thumbnails over plain http, which a https page will block. */
export function normalizeCover(url: string | undefined): string | null {
  return url ? url.replace("http:", "https:") : null;
}

/** Lowercase, unaccented, punctuation-free, for comparing two titles. */
function normalizeTitle(value: string): string {
  return (
    value
      .toLowerCase()
      // NFKD first so an accented letter splits into a plain letter plus its
      // mark; the replace below then drops the mark and keeps the letter.
      // Without it the whole character would go, turning "Poincaré" into
      // "poincar" against Google's "poincare".
      .normalize("NFKD")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Words too common to prove two titles are about the same book. */
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for",
  "is", "how", "why", "your", "you", "it", "at", "be", "with",
]);

/**
 * Is the volume Google returned actually the book that was asked for?
 *
 * Google's ranking will happily answer a miss with something unrelated rather
 * than nothing: asking for "The Mind of Napoleon" came back with a nursing
 * exam prep guide, whose cover then went on the reader's shelf as though it
 * were their book. A wrong cover is worse than no cover, because no cover has
 * a designed fallback and a wrong one just looks broken.
 *
 * Deliberately tolerant of subtitles in either direction, since the shelf
 * stores "Influence" where Google holds "Influence: The Psychology of
 * Persuasion". Beyond that it asks that most of the asked-for title's
 * distinctive words actually appear.
 */
export function titlesMatch(requested: string, returned: string | undefined): boolean {
  const main = (value: string) => normalizeTitle(value.split(/[:：]/)[0]);
  const want = main(requested);
  const got = main(returned ?? "");
  return !!want && want === got;
}
