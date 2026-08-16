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
