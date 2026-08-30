"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  TrendingUp,
  Handshake,
  Brain,
  Coins,
  Building2,
  Flame,
  ChevronRight,
} from "lucide-react";
import { BackButton } from "@/components/back-button";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext } from "@/lib/BookwormContext";
import { MASTERY_PILLARS } from "@/lib/mastery-library";

const PILLAR_ICONS: Record<string, typeof TrendingUp> = {
  sales: TrendingUp,
  negotiation: Handshake,
  "human-nature": Brain,
  money: Coins,
  business: Building2,
  relentlessness: Flame,
};

/**
 * Personal Development: the six pillars, as a recommendation shelf.
 *
 * These 150 books are the ones people actually reach for in this space, grouped
 * so a reader who knows they want to get better at negotiating does not have to
 * already know which book to ask for. Tapping one starts the ordinary 7-day
 * course, so this is a way in to the course rather than a separate product.
 */
export default function MasteryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { courses } = useBookwormContext();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // How many books in each pillar are already on the shelf, and how many are
  // finished. Derived from the reader's actual courses rather than tracked
  // separately, so it can never disagree with what the shelf shows.
  const counts = useMemo(() => {
    const onShelf = new Map(courses.map((c) => [c.book.title.trim().toLowerCase(), c]));
    const next: Record<string, { started: number; read: number }> = {};
    for (const pillar of MASTERY_PILLARS) {
      for (const book of pillar.books) {
        const course = onShelf.get(book.title.trim().toLowerCase());
        if (!course) continue;
        const slot = (next[pillar.slug] ??= { started: 0, read: 0 });
        slot.started += 1;
        if (course.days.every((d) => d.isCompleted)) slot.read += 1;
      }
    }
    return next;
  }, [courses]);

  if (loading || !user) return null;

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto bg-[#0a0a0a] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/50" />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-4 pb-16 pt-4">
        <div className="mb-6 flex items-center gap-2">
          <BackButton to="/dashboard" label="Back to your shelf" />
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

        <h1 className="text-center text-3xl font-black tracking-tight md:text-4xl">
          <span className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent">
            Personal Development
          </span>
        </h1>
        <p className="mx-auto mt-2 mb-8 max-w-md text-center text-sm text-white/60">
          Six pillars, 25 books each. The ones people actually reach for, picked so you don&apos;t
          have to know the title already. Tap one to start its 7-day course.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MASTERY_PILLARS.map((pillar) => {
            const Icon = PILLAR_ICONS[pillar.slug] ?? Brain;
            const tally = counts[pillar.slug];
            return (
              <Link
                key={pillar.slug}
                href={`/mastery/${pillar.slug}`}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#1a1a1a]/60 p-4 transition-all hover:border-[#00D4FF]/50 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00D4FF]/20 to-[#FF006E]/20">
                  <Icon className="h-6 w-6 text-[#00D4FF]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{pillar.name}</p>
                  <p className="truncate text-xs text-white/55">{pillar.blurb}</p>
                  <p className="mt-1 text-[11px] font-semibold text-white/35">
                    {pillar.books.length} books
                    {tally ? ` · ${tally.started} on your shelf` : ""}
                    {tally && tally.read > 0 ? ` · ${tally.read} read` : ""}
                  </p>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-white/25 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60"
                  strokeWidth={2}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
