"use client";

import { useEffect, useRef, useState } from "react";

const LS_PREFIX = "bw_cover_";

/**
 * Cover art for a book whose artwork URL we already stored.
 *
 * Courses can legitimately carry an empty coverUrl: when a title is started
 * from the Personal Development library and the Google Books lookup misses,
 * the course is still created with `coverUrl: ""` on purpose, because a lookup
 * failing must not stop a reader starting a book. Every screen then passed
 * that empty string straight to an <img>, which browsers resolve against the
 * current page — so the shelf asked for the page again, logged
 * "An empty string was passed to the src attribute", and drew a broken-image
 * icon where the cover belongs.
 *
 * A stored URL can also simply stop working, so a load failure falls back the
 * same way rather than leaving the broken icon on screen.
 *
 * Either way it hands off to BookCover, which already knows how to stand in
 * for missing artwork: it shows the title's initials and quietly tries a
 * lookup of its own, caching the answer.
 */
export function StoredBookCover({
  title,
  author,
  coverUrl,
  className = "",
  rounded = "rounded-md",
  loading = "lazy",
}: {
  title: string;
  author: string;
  coverUrl: string;
  className?: string;
  rounded?: string;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);

  // A different book is a different verdict; without this, one dead URL would
  // keep the fallback showing for every book rendered by the same element.
  useEffect(() => setFailed(false), [coverUrl]);

  if (!coverUrl || failed) {
    return <BookCover title={title} author={author} className={className} rounded={rounded} />;
  }

  return (
    <div className={`relative overflow-hidden bg-black ${rounded} ${className}`}>
      {/* Plain <img> for the same reason BookCover uses one: these are
          arbitrary Google Books URLs and next/image is unoptimized here
          anyway, so it buys nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt={`${title} cover`}
        loading={loading}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

/**
 * Cover art for a book we already know by name.
 *
 * A pillar shelf renders 25 of these, so the lookup is deferred until the
 * card is actually near the viewport, and answers are kept in localStorage.
 * Artwork for a fixed library never changes, so a reader pays for the lookup
 * once and every later visit renders instantly from cache.
 *
 * A book with no artwork is cached as a miss and falls back to its initials,
 * rather than being looked up again on every visit to get the same answer.
 */
export function BookCover({
  title,
  author,
  className = "",
  rounded = "rounded-md",
}: {
  title: string;
  author: string;
  className?: string;
  rounded?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const key = LS_PREFIX + `${title}|${author}`.toLowerCase();

    try {
      const cached = localStorage.getItem(key);
      if (cached !== null) {
        setSrc(cached || null);
        setSettled(true);
        return;
      }
    } catch {
      // Storage unavailable (private mode, quota). Fetching still works.
    }

    const el = ref.current;
    if (!el) return;

    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/books/cover?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`
        );
        const data = await res.json();
        if (cancelled) return;
        const url: string | null = data?.coverUrl ?? null;
        setSrc(url);
        try {
          localStorage.setItem(key, url ?? "");
        } catch {
          // Cache is an optimisation, never a requirement.
        }
      } catch {
        if (!cancelled) setSrc(null);
      } finally {
        if (!cancelled) setSettled(true);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      // Start slightly before the card scrolls in, so artwork is usually
      // there by the time it is actually looked at.
      { rootMargin: "300px" }
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [title, author]);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-[#111] ${rounded} ${className}`}
    >
      {src ? (
        // Plain <img>: these are arbitrary Google Books URLs and next/image is
        // configured unoptimized anyway, so there is nothing to gain here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${title} cover`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setSrc(null)}
        />
      ) : (
        // A branded cover rather than initials-on-a-gradient: a book with no
        // real artwork still looks like a book, not like a placeholder.
        // Faded in on `settled` for the same reason the initials used to be -
        // popping in the instant the lookup starts reads as a flash, not
        // content.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/brand/book-cover-fallback.webp"
          alt={`${title} cover`}
          className={`h-full w-full object-cover transition-opacity ${
            settled ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
