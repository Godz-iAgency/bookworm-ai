"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, RefreshCw, Trash2, Type } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BookCover } from "@/components/book-cover";
import { useAuth } from "@/context/AuthContext";
import { bookBySlug, pillarBySlug } from "@/lib/mastery-library";
import {
  useSummaryGeneration,
  loadSummary,
  deleteSummary,
  summaryId,
  type MasterySummary,
} from "@/lib/useSummaryGeneration";
import { useReadingPrefs } from "@/lib/ReadingPrefsContext";
import { FONT_SCALE, FONT_SIZE_ORDER } from "@/lib/reading-prefs";
import { parseLesson } from "@/lib/lesson";

export default function SummaryPage({
  params,
}: {
  params: Promise<{ pillar: string; book: string }>;
}) {
  const { pillar: pillarSlug, book: bookSlug } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { fontSize, setFontSize } = useReadingPrefs();
  const { generate, isGenerating, error, progress, phase } = useSummaryGeneration();

  const [summary, setSummary] = useState<MasterySummary | null>(null);
  const [checked, setChecked] = useState(false);
  const [showSizes, setShowSizes] = useState(false);

  const pillar = pillarBySlug(pillarSlug);
  const book = bookBySlug(pillarSlug, bookSlug);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !book) return;
    let cancelled = false;
    loadSummary(user.uid, summaryId(pillarSlug, bookSlug))
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
  }, [user, book, pillarSlug, bookSlug]);

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

  const handleGenerate = async () => {
    const result = await generate(pillarSlug, book);
    if (result) setSummary(result);
  };

  const handleDelete = async () => {
    if (!user) return;
    await deleteSummary(user.uid, summaryId(pillarSlug, bookSlug));
    setSummary(null);
  };

  // Generation in flight: real progress, since a full summary is a long wait
  // and a spinner alone gives the reader nothing to judge it by.
  if (isGenerating) {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
        <div className="w-full max-w-sm">
          <p className="mb-1 text-sm font-semibold text-[#00D4FF]">{book.title}</p>
          <h2 className="mb-6 text-xl font-bold">
            {phase === "planning"
              ? "Mapping the book's structure..."
              : phase === "saving"
                ? "Saving to your shelf..."
                : `Writing section ${Math.min(progress.done + 1, progress.total)} of ${progress.total}...`}
          </h2>

          <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black">
            <div
              className="h-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-all duration-500"
              style={{ width: `${phase === "planning" ? 6 : pct}%` }}
            />
          </div>

          <p className="mt-4 text-xs text-white/40">
            5 sections, written one at a time so nothing gets skipped. Takes a minute or two.
          </p>
        </div>
      </div>
    );
  }

  const scale = FONT_SCALE[fontSize];

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

          {summary && (
            <div className="relative ml-auto">
              <button
                onClick={() => setShowSizes((o) => !o)}
                aria-label="Text size"
                aria-expanded={showSizes}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Type className="h-4 w-4" strokeWidth={2} />
              </button>
              {showSizes && (
                <div className="absolute right-0 top-full z-30 mt-2 flex gap-1 rounded-xl border border-white/10 bg-[#1a1a1a] p-1.5 shadow-2xl">
                  {FONT_SIZE_ORDER.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setFontSize(size);
                        setShowSizes(false);
                      }}
                      className={`h-9 w-9 rounded-lg text-sm font-bold transition-colors ${
                        fontSize === size
                          ? "bg-[#00D4FF]/20 text-[#00D4FF]"
                          : "text-white/50 hover:bg-white/10"
                      }`}
                      style={{ fontSize: `${10 + FONT_SIZE_ORDER.indexOf(size) * 2}px` }}
                    >
                      {FONT_SCALE[size].sample}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

        {!checked ? null : !summary ? (
          /* Nothing generated yet. */
          <div className="mt-8">
            <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/60 p-5">
              <h2 className="mb-2 font-bold">What you&apos;ll get</h2>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>A long-form summary, roughly 18 to 25
                  pages across 5 sections, following the book&apos;s real structure front to back.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>The author&apos;s actual frameworks and
                  terminology, defined and worked through their own examples.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>Written in the register of the book
                  itself, not a neutral textbook voice.
                </li>
              </ul>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="mt-5 h-13 w-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.02]"
            >
              Generate Summary →
            </button>
            <p className="mt-3 text-center text-xs text-white/40">
              Free. This doesn&apos;t use a course generation.
            </p>
          </div>
        ) : (
          /* The summary itself. */
          <>
            {!summary.confident && (
              <div className="mt-5 flex gap-3 rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-[#FFB020]" strokeWidth={2} />
                <p className="text-xs leading-relaxed text-[#FFB020]">
                  This one was written from general knowledge of the author and topic rather than
                  detailed recall of the book, so treat the specifics with care.
                </p>
              </div>
            )}

            {summary.thesis && (
              <div className="mt-5 rounded-xl border-l-2 border-[#00D4FF] bg-[#00D4FF]/[0.06] py-3 pl-4 pr-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#00D4FF]">
                  The argument
                </p>
                <p className="mt-1.5 font-reading text-[15px] leading-relaxed text-white/85">
                  {summary.thesis}
                </p>
              </div>
            )}

            {summary.frameworks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {summary.frameworks.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/70"
                  >
                    {f}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/30">
              {summary.sections.length} sections · {summary.wordCount.toLocaleString()} words · about{" "}
              {Math.max(1, Math.round(summary.wordCount / 250))} pages
            </p>

            <div className="my-6 h-px w-full bg-white/10" />

            <article className="font-reading">
              {summary.sections.map((section, i) => (
                <section key={i} className="mb-10">
                  <h2
                    className="mb-4 font-bold leading-tight text-white"
                    style={{ fontSize: `${scale.heading + 4}px` }}
                  >
                    <span className="mr-2 text-[#00D4FF]/60">{i + 1}.</span>
                    {section.title}
                  </h2>

                  {parseLesson(section.prose).map((b, j) =>
                    b.type === "heading" ? (
                      <h3
                        key={j}
                        className="mb-2 mt-6 font-bold text-white/90"
                        style={{ fontSize: `${scale.heading}px` }}
                      >
                        {b.text}
                      </h3>
                    ) : (
                      <p
                        key={j}
                        className={`mb-4 text-white/85 ${b.type === "item" ? "pl-4" : ""}`}
                        style={{ fontSize: `${scale.body}px`, lineHeight: scale.lineHeight }}
                      >
                        {b.text}
                      </p>
                    )
                  )}
                </section>
              ))}
            </article>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-white/10 pt-6 sm:flex-row">
              <button
                onClick={handleGenerate}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-bold text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2} />
                Regenerate
              </button>
              <button
                onClick={handleDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-bold text-white/50 transition-colors hover:border-[#FF006E]/50 hover:bg-[#FF006E]/10 hover:text-[#FF006E]"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                Remove
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
