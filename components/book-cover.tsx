"use client";

import { useEffect, useRef, useState } from "react";

const LS_PREFIX = "bw_cover_";

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

  const initials = title
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-gradient-to-br from-[#00D4FF]/15 to-[#FF006E]/15 ${rounded} ${className}`}
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
        <div className="flex h-full w-full items-center justify-center">
          <span
            className={`text-[10px] font-black tracking-wider text-white/40 transition-opacity ${
              settled ? "opacity-100" : "opacity-0"
            }`}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}
