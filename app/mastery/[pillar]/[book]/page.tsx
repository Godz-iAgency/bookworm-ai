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
  nextSectionIndex,
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
  const { generate, generateNextSection, isGenerating, error, progress, phase, writingIndex } =
    useSummaryGeneration();

  const [summary, setSummary] = useState<MasterySummary | null>(null);
  const [checked, setChecked] = useState(false);
  /** Section to open the reader at after it has just been written. */
  const [jumpToSection, setJumpToSection] = useState<number | null>(null);

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

  /**
   * Write the next section, then drop the reader into it.
   *
   * The target is captured before the call, because once it lands it is no
   * longer "next" and there would be nothing left to point the reader at.
   */
  const handleGenerateNext = useCallback(async () => {
    if (!summary) return;
    const target = nextSectionIndex(summary);
    const result = await generateNextSection(summary);
    if (!result) return;
    setSummary(result);
    if (target !== null && result.sections[target]?.prose?.trim()) {
      setJumpToSection(target);
    }
  }, [summary, generateNextSection]);

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

  // One section is in flight. Roughly a minute, for one section, so this is a
  // single focused wait rather than the multi-minute progress board the old
  // generate-everything flow needed.
  if (isGenerating) {
    const total = progress.total || SUMMARY_SECTION_COUNT;
    const shownIndex = writingIndex ?? progress.done;
    const planned = summary?.plan;
    const title = planned?.[shownIndex]?.title;
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#0a0a0a] px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <p className="mb-1 text-sm font-semibold text-[#00D4FF]">{book.title}</p>
          <h2 className="mb-2 text-xl font-bold">
            {phase === "planning"
              ? "Mapping the book's structure..."
              : `Writing section ${shownIndex + 1} of ${total}`}
          </h2>
          {phase !== "planning" && title && (
            <p className="mb-6 text-sm text-white/60">{title}</p>
          )}

          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black">
            <div
              className="h-full animate-pulse bg-gradient-to-r from-[#00D4FF] to-[#FF006E]"
              style={{
                width: `${phase === "planning" ? 8 : Math.round(((shownIndex + 0.5) / total) * 100)}%`,
              }}
            />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-white/40">
            {phase === "planning"
              ? `Planning all ${total} sections, then writing the first one. The rest are written when you ask for them.`
              : "About a minute. It saves as soon as it lands, so nothing is lost if you leave."}
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
        onGenerateNext={handleGenerateNext}
        onRegenerate={handleGenerate}
        onDelete={handleDelete}
        onProgress={handleProgress}
        jumpToSection={jumpToSection}
        onJumped={() => setJumpToSection(null)}
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
              <h2 className="mb-2 font-bold">How this one works</h2>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>
                  {SUMMARY_SECTION_COUNT} sections following the book&apos;s real structure front to
                  back, around 45 to 60 pages once it&apos;s all written.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>
                  <span>
                    <span className="text-white/90">One section at a time.</span> You get section one
                    now, and each following section when you ask for it, so you read at your pace
                    instead of waiting on the whole book.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>The author&apos;s actual frameworks and
                  terminology, defined and worked through their own examples.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>A paged reader that remembers where you
                  stopped. Nothing expires, and it stays on your shelf.
                </li>
              </ul>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={planned > 0 ? handleGenerateNext : handleGenerate}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.02]"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
              {planned > 0 ? "Try section 1 again" : "Start with section 1"}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/40">
              Free, and it doesn&apos;t use a course generation. About a minute for the first
              section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
