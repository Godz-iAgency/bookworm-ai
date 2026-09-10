"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/profile";
import { pickRecommendations } from "@/lib/recommendations";

/**
 * Three books to read next, under the shelf.
 *
 * Always present, including for a reader with an empty shelf — someone between
 * books is exactly who needs a suggestion, and the dashboard otherwise offers
 * them nothing but a search box.
 *
 * Tapping one goes to that book's Personal Development page rather than
 * generating on the spot: starting a course spends one of the reader's monthly
 * generations, which is not something a mis-tap on the home screen should be
 * able to do. That page is also already the one that knows how to resolve a
 * cover, honour the saved reading level, and notice a book is on the shelf
 * already — so this row stays a way in to it, not a second copy of it.
 */
export function RecommendedShelf({ shelfTitles }: { shelfTitles: string[] }) {
  const { user } = useAuth();
  const [topics, setTopics] = useState<string[] | null>(null);

  // One seed per mount: the picks hold still while the reader looks at them,
  // and they get a different three next time they open the app.
  const seed = useRef(Math.floor(Math.random() * 2 ** 31)).current;

  useEffect(() => {
    if (!user) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    getUserProfile(user.uid)
      .then((profile) => {
        if (!cancelled) setTopics(profile?.genrePreferences ?? []);
      })
      .catch((e) => {
        console.error("Could not load reading preferences:", e);
        // Falls back to picks from the whole library rather than no row.
        if (!cancelled) setTopics([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const picks = useMemo(
    () =>
      topics === null
        ? []
        : pickRecommendations({ topics, excludeTitles: shelfTitles, seed }),
    [topics, shelfTitles, seed]
  );

  if (topics === null || picks.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#00D4FF]" strokeWidth={2.5} />
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/70">
          Recommended for you
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((rec) => (
          <Link
            key={`${rec.pillarSlug}/${rec.book.slug}`}
            href={`/mastery/${rec.pillarSlug}/${rec.book.slug}`}
            className="group flex gap-4 rounded-2xl border border-white/10 p-4 transition-all hover:border-white/25 hover:bg-white/5"
          >
            <BookCover
              title={rec.book.title}
              author={rec.book.author}
              className="h-24 w-16 shrink-0 shadow-md"
              rounded="rounded-lg"
            />

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">
                {rec.pillarName}
              </p>
              <p className="mt-1 truncate text-base font-bold">{rec.book.title}</p>
              <p className="truncate text-xs text-white/50">{rec.book.author}</p>

              <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold text-white/60 transition-colors group-hover:text-white">
                Start this book
                <ChevronRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.5}
                />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
