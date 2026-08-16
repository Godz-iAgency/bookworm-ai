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
import { loadAllSummaries, summaryId } from "@/lib/useSummaryGeneration";

/** One pillar's 25 books. A tick marks the ones already summarised. */
export default function PillarPage({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar: pillarSlug } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [have, setHave] = useState<Set<string>>(new Set());

  const pillar = pillarBySlug(pillarSlug);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadAllSummaries(user.uid)
      .then((all) => {
        if (!cancelled) setHave(new Set(all.map((s) => s.id)));
      })
      .catch((e) => console.error("Could not load summaries:", e));
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
            const done = have.has(summaryId(pillar.slug, book.slug));
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
                </div>
                {done ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#00D4FF]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                    Ready
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
