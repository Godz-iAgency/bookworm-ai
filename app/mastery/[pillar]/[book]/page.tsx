"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BookCover } from "@/components/book-cover";
import { useAuth } from "@/context/AuthContext";
import { bookBySlug, pillarBySlug } from "@/lib/mastery-library";
import { SUMMARY_SECTION_COUNT } from "@/lib/mastery-prompts";
import {
  useSummaryGeneration,
  loadSummary,
  deleteSummary,
  saveReadingProgress,
  summaryId,
  missingSectionIndexes,
  writtenSections,
  type MasterySummary,
} from "@/lib/useSummaryGeneration";
import SummaryReader from "./SummaryReader";

export default function SummaryPage({
  params,
}: {
  params: Promise<{ pillar: string; book: string }>;
}) {
  const { pillar: pillarSlug, book: bookSlug } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { generate, continueGeneration, isGenerating, error, progress, phase, partial } =
    useSummaryGeneration();

  const [summary, setSummary] = useState<MasterySummary | null>(null);
  const [checked, setChecked] = useState(false);

  const pillar = pillarBySlug(pillarSlug);
  const book = bookBySlug(pillarSlug, bookSlug);
  const id = summaryId(pillarSlug, bookSlug);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !book) return;
    let cancelled = false;
    loadSummary(user.uid, id)
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
        setChecked(true);
      })
      .catch((e) => {
        console.error("Could not load summary:", e);
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, book, id]);

  const handleGenerate = useCallback(async () => {
    if (!book) return;
    const result = await generate(pillarSlug, book);
    if (result) setSummary(result);
  }, [book, generate, pillarSlug]);

  const handleContinue = useCallback(async () => {
    if (!summary) return;
    const result = await continueGeneration(summary);
    if (result) setSummary(result);
  }, [summary, continueGeneration]);

  const handleDelete = useCallback(async () => {
    if (!user) return;
    await deleteSummary(user.uid, id);
    setSummary(null);
  }, [user, id]);

  // Position is written straight through rather than held in state: the reader
  // already debounces, and re-rendering to record a page number on every turn
  // would be work for something nothing on screen displays.
  //
  // Finishing the book is the exception. That does change what is on screen (the
  // Complete badge), and a reader who just turned the last page should see it
  // then, not the next time they open the book.
  const handleProgress = useCallback(
    (value: number, complete: boolean) => {
      if (!user) return;
      if (complete) {
        setSummary((s) =>
          s && !s.completedAt ? { ...s, progress: value, completedAt: new Date().toISOString() } : s
        );
      }
      saveReadingProgress(user.uid, id, value, complete).catch((e) =>
        console.error("Could not save reading position:", e)
      );
    },
    [user, id]
  );

  if (loading || !user) return null;

  if (!pillar || !book) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-6 text-center text-white">
        <p className="text-white/70">That book isn&apos;t in the library.</p>
        <Link
          href="/mastery"
          className="rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-6 py-2.5 font-bold"
        >
          Back to Personal Development
        </Link>
      </div>
    );
  }

  // Generation in flight. Ten sections is a several-minute wait, so this shows
  // the sections landing one by one rather than a spinner: the reader can see it
  // is working, and can see exactly how much is left.
  if (isGenerating) {
    const shown = partial ?? summary;
    const total = progress.total || SUMMARY_SECTION_COUNT;
    const pct = total > 0 ? Math.round((progress.done / total) * 100) : 0;
    return (
      <div className="flex min-h-dvh w-full flex-col items-center bg-[#0a0a0a] px-6 py-10 text-white">
        <div className="w-full max-w-sm">
          <p className="mb-1 text-center text-sm font-semibold text-[#00D4FF]">{book.title}</p>
          <h2 className="mb-6 text-center text-xl font-bold">
            {phase === "planning"
              ? "Mapping the book's structure..."
              : `Writing section ${Math.min(progress.done + 1, total)} of ${total}...`}
          </h2>

          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black">
            <div
              className="h-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-all duration-500"
              style={{ width: `${phase === "planning" ? 4 : Math.max(pct, 4)}%` }}
            />
          </div>

          {shown?.plan && shown.plan.length > 0 && (
            <div className="mt-6 flex flex-col gap-1">
              {shown.plan.map((item, i) => {
                const done = !!shown.sections[i]?.prose?.trim();
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
                      done ? "text-white/80" : "text-white/30"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                        done ? "bg-[#00D4FF] text-black" : "border border-white/20"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-white/40">
            {total} sections, written one at a time so nothing gets skipped, and saved as each one
            lands. You can leave this page and come back, nothing already written is lost.
          </p>
        </div>
      </div>
    );
  }

  // A summary exists: hand the whole screen over to the reader.
  if (summary && writtenSections(summary).length > 0) {
    return (
      <SummaryReader
        summary={summary}
        pillarName={pillar.name}
        backHref={`/mastery/${pillarSlug}`}
        missingCount={missingSectionIndexes(summary).length}
        onContinue={handleContinue}
        onRegenerate={handleGenerate}
        onDelete={handleDelete}
        onProgress={handleProgress}
      />
    );
  }

  // Nothing generated yet (or a plan whose every section failed).
  const planned = summary?.plan?.length ?? 0;

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto bg-[#0a0a0a] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/50" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col px-4 pb-20 pt-4">
        <div className="mb-5 flex items-center gap-2">
          <BackButton to={`/mastery/${pillarSlug}`} label={`Back to ${pillar.name}`} />
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

        <div className="flex items-start gap-4">
          <BookCover
            title={book.title}
            author={book.author}
            className="h-[104px] w-[72px] shrink-0 shadow-lg"
            rounded="rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#00D4FF]">
              {pillar.name}
            </p>
            <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight md:text-3xl">
              {book.title}
            </h1>
            <p className="mt-1 text-sm text-white/55">{book.author}</p>
          </div>
        </div>

        {!checked ? null : (
          <div className="mt-8">
            <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/60 p-5">
              <h2 className="mb-2 font-bold">What you&apos;ll get</h2>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>A long-form summary, roughly 45 to 60
                  pages across {SUMMARY_SECTION_COUNT} sections, following the book&apos;s real
                  structure front to back.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>The author&apos;s actual frameworks and
                  terminology, defined and worked through their own examples.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>A proper paged reader that remembers where
                  you stopped, and keeps the book on your shelf for good.
                </li>
              </ul>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={planned > 0 ? handleContinue : handleGenerate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
              {planned > 0 ? "Try these sections again" : "Generate Summary"}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/40">
              Free, and it doesn&apos;t use a course generation. Takes a few minutes, and saves as it
              goes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
