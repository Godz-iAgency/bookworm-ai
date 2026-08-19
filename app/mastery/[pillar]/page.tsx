"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BookCover } from "@/components/book-cover";
import { useAuth } from "@/context/AuthContext";
import { pillarBySlug } from "@/lib/mastery-library";
import { loadSummaryIndex, summaryId, type SummaryIndex } from "@/lib/useSummaryGeneration";

/**
 * One pillar's 25 books, each showing where the reader is in it.
 *
 * The whole point of a shelf you keep is being able to see it: which books are
 * read, which are part-read and where you stopped, which are untouched. A list
 * where all 25 rows look identical whether you have read none of a book or all
 * of it makes coming back to one a matter of remembering rather than looking.
 */
export default function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar: pillarSlug } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [index, setIndex] = useState<SummaryIndex>({});

  const pillar = pillarBySlug(pillarSlug);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadSummaryIndex(user.uid)
      .then((idx) => {
        if (!cancelled) setIndex(idx);
      })
      .catch((e) => console.error("Could not load the summary index:", e));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user) return null;

  if (!pillar) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-6 text-center text-white">
        <p className="text-white/70">That category doesn&apos;t exist.</p>
        <Link
          href="/mastery"
          className="rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-6 py-2.5 font-bold"
        >
          Back to Personal Development
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto bg-[#0a0a0a] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/50" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-4 pb-16 pt-4">
        <div className="mb-5 flex items-center gap-2">
          <BackButton to="/mastery" label="Back to categories" />
          <Link href="/dashboard" aria-label="Back to your shelf">
            <Image
              src="/bookworm-logo.png"
              alt="Bookworm.AI"
              width={92}
              height={24}
              priority
              className="opacity-90"
            />
          </Link>
        </div>

        <h1 className="text-center text-3xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent">
            {pillar.name}
          </span>
        </h1>
        <p className="mx-auto mt-1.5 mb-6 max-w-sm text-center text-sm text-white/60">
          {pillar.blurb} Tap a book to generate its summary.
        </p>

        <div className="space-y-2">
          {pillar.books.map((book, i) => {
            const entry = index[summaryId(pillar.slug, book.slug)];
            const pct = entry ? Math.round(entry.progress * 100) : 0;
            const partial =
              !!entry && entry.sectionsPlanned > 0 && entry.sectionsWritten < entry.sectionsPlanned;
            return (
              <Link
                key={book.slug}
                href={`/mastery/${pillar.slug}/${book.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1a1a]/60 px-3 py-3 transition-all hover:border-[#00D4FF]/50 hover:bg-white/5"
              >
                <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-white/25">
                  {i + 1}
                </span>
                <BookCover
                  title={book.title}
                  author={book.author}
                  className="h-14 w-10 shrink-0 shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{book.title}</p>
                  <p className="truncate text-xs text-white/50">{book.author}</p>

                  {/* Only generated books get a second line, so an untouched
                      shelf stays quiet and a part-read one stands out. */}
                  {entry && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E]"
                          style={{ width: `${entry.complete ? 100 : Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-white/35">
                        {partial
                          ? `${entry.sectionsWritten}/${entry.sectionsPlanned} written`
                          : entry.complete
                            ? "Read"
                            : pct > 0
                              ? `${pct}%`
                              : "Not started"}
                      </span>
                    </div>
                  )}
                </div>

                {entry?.complete ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#00D4FF]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                    Complete
                  </span>
                ) : entry ? (
                  <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/55">
                    {pct > 0 ? "Resume" : "Ready"}
                  </span>
                ) : (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60"
                    strokeWidth={2}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
