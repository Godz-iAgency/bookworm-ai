/**
 * Bookworm.AI service worker.
 *
 * Google Play packaging (via PWA Builder) expects a service worker, and an
 * installed app that shows the browser's dinosaur when the signal drops feels
 * broken in a way a website does not. So this exists to do two narrow jobs
 * well rather than to cache the whole app:
 *
 *   1. show a real "you're offline" page instead of a browser error
 *   2. serve Next's content-hashed static chunks from cache
 *
 * What it deliberately does NOT do:
 *
 *   - cache anything under /api/. Those responses carry billing state, plan
 *     limits and course content tied to whoever was signed in. A cached one
 *     served to the next session would be both wrong and a privacy problem.
 *   - cache page HTML. Navigations always go to the network first, so a
 *     deploy is live immediately; the cache only ever answers when the
 *     network has already failed.
 *
 * Bump CACHE_VERSION to force every client to drop its old cache.
 */

const CACHE_VERSION = "bookworm-v1";
const OFFLINE_URL = "/offline";

// Kept small on purpose: these are the only things needed to render something
// meaningful with no connection at all.
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Individually, not addAll: addAll rejects the whole install if a single
      // URL 404s, which would leave the app with no service worker at all
      // over one missing icon.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => console.warn("[sw] could not precache", url, err))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Anything that changes state, or belongs to another origin (Firebase,
  // Stripe, Google Books), is none of this worker's business.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never touch the API. See the note at the top.
  if (url.pathname.startsWith("/api/")) return;

  // Next's build output is content-hashed, so a given URL's bytes never
  // change. Cache-first is safe here and is what makes a warm start quick.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  // Our own icons: same reasoning, they change only when the version bumps.
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
    return;
  }

  // Page loads: always the network, so a deploy is never held back by a
  // cache. The offline page answers only once the network has actually failed.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          return (
            cached ??
            new Response("You're offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })()
    );
  }
});
