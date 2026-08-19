"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  List,
  BookOpen,
  ScrollText,
  RefreshCw,
  Trash2,
  Check,
  AlertTriangle,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { parseLesson } from "@/lib/lesson";
import { buildAmazonLink } from "@/lib/amazon";
import { useReadingPrefs } from "@/lib/ReadingPrefsContext";
import { FONT_SCALE, FONT_SIZE_ORDER } from "@/lib/reading-prefs";
import { usePagedReader, COLUMN_GAP, PAGE_PAD_Y } from "@/lib/usePagedReader";
import { writtenSections, type MasterySummary } from "@/lib/useSummaryGeneration";

/** How long the reader has to sit still on a page before the position is saved. */
const PROGRESS_SAVE_DELAY = 1200;

/** Ignore position changes smaller than this, so a long book isn't 60 writes. */
const PROGRESS_EPSILON = 0.004;

const MODE_KEY = "bw_summary_mode";

/**
 * Scroll-vs-page for summaries, kept separate from the lesson reader's shared
 * preference and defaulted to pages.
 *
 * Summaries are 45 to 60 pages where a lesson is 3 or 4. Inheriting the lesson
 * default of "scroll" would drop the reader into a single scrollbar tens of
 * screens long with no sense of where they are in it, which is the exact problem
 * pagination exists to solve. The toggle is still there for anyone who wants it.
 */
function useSummaryMode() {
  const [mode, setMode] = useState<"page" | "scroll">("page");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "scroll" || saved === "page") setMode(saved);
    } catch {
      // Private mode or a blocked store: the default is fine.
    }
  }, []);

  const update = useCallback((next: "page" | "scroll") => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // Not worth surfacing; the choice just won't outlive the session.
    }
  }, []);

  return [mode, update] as const;
}

interface SummaryReaderProps {
  summary: MasterySummary;
  pillarName: string;
  /** Back to the pillar's book list. */
  backHref: string;
  /** Sections planned but not yet written, if any. */
  missingCount: number;
  onContinue: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  /** Fired on settled page changes, already debounced by this component. */
  onProgress: (progress: number, complete: boolean) => void;
}

/**
 * The summary reader: a whole book in one continuous flow, paginated.
 *
 * The whole summary is a single multi-column flow rather than ten separately
 * paginated sections. That is what makes it read as a book: the page count is
 * the length of the book, the progress bar means something, and each section
 * simply starts on a fresh page the way a chapter does. Section boundaries are
 * then measured back out of the laid-out columns to build the contents list.
 */
export default function SummaryReader({
  summary,
  pillarName,
  backHref,
  missingCount,
  onContinue,
  onRegenerate,
  onDelete,
  onProgress,
}: SummaryReaderProps) {
  const { fontSize, setFontSize } = useReadingPrefs();
  const scale = FONT_SCALE[fontSize];
  const [mode, setMode] = useSummaryMode();
  const paged = mode === "page";

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Keyed on the sections array, not the summary object: marking the book
  // complete produces a new summary object with the same prose, and re-parsing
  // 12,000 words to light up a badge would be a visible stall.
  const sections = useMemo(() => writtenSections(summary), [summary.sections]);

  // Parsed once per summary rather than on every page turn: at 12,000 words this
  // is real work, and a page turn must not pay for it.
  const parsed = useMemo(
    () => sections.map((s) => ({ title: s.title, blocks: parseLesson(s.prose) })),
    [sections]
  );

  const handlePageChange = usePersistProgress(onProgress);

  const reader = usePagedReader({
    enabled: paged,
    lineHeightPx: scale.body * scale.lineHeight,
    // No remeasureKey for the panel on purpose: it floats over the text rather
    // than shortening it, so opening it cannot change the pagination. That is
    // what makes the page numbers in the contents list trustworthy.
    contentKey: `${fontSize}|${summary.wordCount}|${sections.length}`,
    resetKey: summary.id,
    initialProgress: summary.progress ?? 0,
    onPageChange: handlePageChange,
  });
  const { page, pageCount, goPrev, goNext, jumpTo } = reader;

  // ---- Contents -------------------------------------------------------------
  // Which page each section starts on, read back out of the real layout once the
  // browser has flowed the text. Derived rather than predicted: there is no way
  // to know where a section lands without letting the browser paginate first.
  const sectionAnchors = useRef<(HTMLElement | null)[]>([]);
  const [sectionPages, setSectionPages] = useState<number[]>([]);

  useEffect(() => {
    if (!paged || !reader.columnWidth) return;
    let cancelled = false;
    const measure = () => {
      const col = reader.columnsRef.current;
      if (cancelled || !col) return;
      const base = col.getBoundingClientRect().left;
      const perPage = reader.spread ? 2 : 1;
      const columnStride = reader.columnWidth + COLUMN_GAP;
      setSectionPages(
        sectionAnchors.current.map((el) => {
          if (!el) return 0;
          // Both rects sit inside the same translated element, so the transform
          // cancels out of the difference and this is a pure layout offset.
          const offset = el.getBoundingClientRect().left - base;
          const columnIndex = Math.max(0, Math.round(offset / columnStride));
          return Math.floor(columnIndex / perPage);
        })
      );
    };
    const raf = requestAnimationFrame(measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [paged, reader.columnWidth, reader.spread, reader.columnsRef, pageCount, fontSize]);

  // The section the reader is currently inside, for the header.
  const currentSection = useMemo(() => {
    let found = -1;
    for (let i = 0; i < sectionPages.length; i++) {
      if (sectionPages[i] <= page) found = i;
    }
    return found;
  }, [sectionPages, page]);

  // Arrow keys, for anyone reading on a laptop or with a keyboard case.
  useEffect(() => {
    if (!paged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, goPrev, goNext]);

  const amazonHref = buildAmazonLink(summary.title, summary.author);
  const finished = !!summary.completedAt;

  // ---- The book's contents, shared by both modes -----------------------------

  const titlePage = (
    <div style={{ breakAfter: "column" }}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#00D4FF]">{pillarName}</p>
      <h1
        className="mt-2 font-black leading-tight tracking-tight text-white"
        style={{ fontSize: scale.heading + 8 }}
      >
        {summary.title}
      </h1>
      <p className="mt-1.5 text-white/55" style={{ fontSize: scale.body - 2 }}>
        {summary.author}
      </p>

      {!summary.confident && (
        <div className="mt-5 flex gap-2.5 rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB020]" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-[#FFB020]">
            Written from general knowledge of the author and topic rather than detailed recall of the
            book, so treat the specifics with care.
          </p>
        </div>
      )}

      {summary.thesis && (
        <div className="mt-5 border-l-2 border-[#00D4FF] bg-[#00D4FF]/[0.06] py-3 pl-4 pr-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#00D4FF]">
            The argument
          </p>
          <p
            className="mt-1.5 text-white/85"
            style={{ fontSize: scale.body - 1, lineHeight: scale.lineHeight }}
          >
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

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-white/30">
        {sections.length} sections · {summary.wordCount.toLocaleString()} words
        {paged && pageCount > 1 ? ` · ${pageCount} pages` : ""}
      </p>
    </div>
  );

  const bookBody = parsed.map((section, i) => (
    <section key={i} id={`summary-section-${i}`}>
      <h2
        ref={(el) => {
          sectionAnchors.current[i] = el;
        }}
        className="font-bold leading-tight text-white"
        style={{
          fontSize: scale.heading + 3,
          marginTop: i === 0 ? 0 : "0.2em",
          marginBottom: "0.8em",
          // Each section opens a fresh page, the way a chapter does. The title
          // page's own break-after covers the first one.
          breakBefore: i === 0 ? "auto" : "column",
          breakInside: "avoid",
          breakAfter: "avoid",
        }}
      >
        <span className="mr-2 text-[#00D4FF]/50 tabular-nums">{i + 1}.</span>
        {section.title}
      </h2>

      {section.blocks.map((b, j) =>
        b.type === "heading" ? (
          <h3
            key={j}
            className="font-bold text-white/90"
            style={{
              fontSize: scale.heading - 3,
              lineHeight: 1.35,
              marginTop: "1.6em",
              marginBottom: "0.5em",
              // A subheading alone at the foot of a page reads as a mistake.
              breakInside: "avoid",
              breakAfter: "avoid",
            }}
          >
            {b.text}
          </h3>
        ) : (
          <p
            key={j}
            className="text-white/85"
            style={{
              fontSize: scale.body,
              lineHeight: scale.lineHeight,
              marginBottom: b.type === "item" ? "0.5em" : "1.1em",
              paddingLeft: b.type === "item" ? "1em" : undefined,
            }}
          >
            {b.text}
          </p>
        )
      )}
    </section>
  ));

  // The last page. Same offer the 7-day course makes when a book is finished:
  // the summary is the map, the book is the territory.
  const endPage = (
    <div style={{ breakBefore: "column" }}>
      {missingCount > 0 ? (
        <>
          <h2 className="font-bold text-white" style={{ fontSize: scale.heading }}>
            {missingCount} {missingCount === 1 ? "section" : "sections"} still to write
          </h2>
          <p
            className="mt-2 text-white/60"
            style={{ fontSize: scale.body - 2, lineHeight: scale.lineHeight }}
          >
            Everything written so far is saved. Continue to fill in the rest.
          </p>
          <button
            onClick={onContinue}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3 text-sm font-bold text-white"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            Continue the summary
          </button>
        </>
      ) : (
        <>
          <p className="text-3xl">🎉</p>
          <h2 className="mt-3 font-black leading-tight text-white" style={{ fontSize: scale.heading + 2 }}>
            That&apos;s the whole book.
          </h2>
          <p
            className="mt-2.5 text-white/60"
            style={{ fontSize: scale.body - 2, lineHeight: scale.lineHeight }}
          >
            You&apos;ve read all {sections.length} sections of {summary.title}. This stays on your
            shelf, so you can come back to any part of it whenever you want.
          </p>
        </>
      )}

      <div className="mt-6 border-t border-white/10 pt-6">
        <p
          className="text-white/70"
          style={{ fontSize: scale.body - 2, lineHeight: scale.lineHeight }}
        >
          Want the real thing on your shelf? A summary gets you the argument; the book gets you the
          author.
        </p>
        <a
          href={amazonHref}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3 text-sm font-bold text-white"
        >
          <ShoppingCart className="h-4 w-4" strokeWidth={2.5} />
          Get the Book on Amazon →
        </a>
        <Link
          href={backHref}
          className="mt-2.5 flex w-full items-center justify-center rounded-full border border-white/20 py-3 text-sm font-bold text-white/80"
        >
          Back to {pillarName}
        </Link>
      </div>
    </div>
  );

  const body = (
    <>
      {titlePage}
      {bookBody}
      {endPage}
    </>
  );

  return (
    <div className="flex h-dvh w-full flex-col bg-[#0a0a0a] text-white">
      {/* Reader chrome — deliberately thin so the text gets the screen. */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 bg-[#0e0e0e] px-3 py-2.5">
        <Link
          href={backHref}
          aria-label={`Back to ${pillarName}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">
            {summary.title}
          </p>
          <p className="truncate text-sm font-bold text-white">
            {currentSection >= 0 && sections[currentSection]
              ? `${currentSection + 1}. ${sections[currentSection].title}`
              : summary.author}
          </p>
        </div>

        {finished && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#00D4FF]"
            title="You've read this one all the way through"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            Complete
          </span>
        )}

        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Contents and reading settings"
          aria-expanded={menuOpen}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
            menuOpen
              ? "border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]"
              : "border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <List className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Everything below the header shares one positioning context, so the
          contents panel can float over the text instead of pushing it. */}
      <div className="relative min-h-0 flex-1">
      {/* Contents + settings. One panel rather than two buttons: on a phone the
          top bar cannot afford three separate controls, and jumping to a section
          and changing the text size are the same kind of act.

          It overlays the text rather than sitting above it in the flow. As a
          sibling it shortened the reading area, which re-paginated the book
          while the panel was open: the page numbers it listed described a
          layout that stopped existing the moment it closed, and tapping one
          landed the reader in the wrong place entirely. */}
      {menuOpen && (
        <>
          <div
            className="absolute inset-0 z-20"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 z-30 max-h-full overflow-y-auto border-b border-white/10 bg-[#141414] px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Size
              </span>
              <div className="flex flex-1 gap-1.5">
                {FONT_SIZE_ORDER.map((id) => (
                  <button
                    key={id}
                    onClick={() => setFontSize(id)}
                    className={`flex-1 rounded-lg border py-1.5 text-center transition-all ${
                      fontSize === id
                        ? "border-[#00D4FF] bg-[#00D4FF]/10 text-white"
                        : "border-white/10 text-white/50 hover:border-white/25"
                    }`}
                  >
                    <span
                      style={{ fontSize: 10 + FONT_SIZE_ORDER.indexOf(id) * 3 }}
                      className="font-bold"
                    >
                      A
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Layout
              </span>
              <div className="flex flex-1 gap-1.5">
                <ModeButton
                  active={!paged}
                  onClick={() => setMode("scroll")}
                  icon={<ScrollText className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="Scroll"
                />
                <ModeButton
                  active={paged}
                  onClick={() => setMode("page")}
                  icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="Pages"
                />
              </div>
            </div>

            {/* Contents. Page numbers make the jump predictable and double as a
                sense of how much of the book each part takes up. */}
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                Contents
              </p>
              <div className="flex flex-col">
                {sections.map((s, i) => {
                  const at = sectionPages[i];
                  const active = currentSection === i;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (paged && typeof at === "number") jumpTo(at);
                        else scrollToSection(i);
                        setMenuOpen(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        active ? "bg-[#00D4FF]/10 text-white" : "text-white/65 hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`w-4 shrink-0 text-center text-[11px] font-bold tabular-nums ${
                          active ? "text-[#00D4FF]" : "text-white/30"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                        {s.title}
                      </span>
                      {paged && typeof at === "number" && (
                        <span className="shrink-0 text-[10px] tabular-nums text-white/30">
                          p.{at + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {missingCount > 0 && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onContinue();
                }}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-2.5 text-xs font-bold text-white"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />
                Write the {missingCount} missing {missingCount === 1 ? "section" : "sections"}
              </button>
            )}

            <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row">
              <a
                href={amazonHref}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-xs font-bold text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />
                Buy the book
              </a>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRegenerate();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-xs font-bold text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                Regenerate
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-xs font-bold text-white/50 transition-colors hover:border-[#FF006E]/50 hover:bg-[#FF006E]/10 hover:text-[#FF006E]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete text
              </button>
            </div>
            <p className="text-center text-[10px] leading-snug text-white/30">
              Deleting only clears the written summary. The book stays in the library.
            </p>
          </div>
          </div>
        </>
      )}

      {/* Reading surface. */}
      <div
        className={`h-full px-5 md:px-8 ${paged ? "overflow-hidden" : "overflow-y-auto"}`}
        // touch-action pan-y: the browser keeps vertical scrolling, we take
        // horizontal. Without it Chrome claims the gesture and the page never
        // follows the finger.
        style={paged ? { touchAction: "pan-y" } : undefined}
        {...(paged ? reader.pointerHandlers : {})}
      >
        {paged ? (
          <div ref={reader.frameRef} className="h-full w-full">
            <div
              className="mx-auto h-full overflow-hidden"
              style={{
                width: reader.pageWidth || "100%",
                paddingTop: PAGE_PAD_Y,
                paddingBottom: PAGE_PAD_Y,
              }}
            >
              {/* x is a motion value driven by the drag and the spring, so
                  turning a page never re-renders 12,000 words - it only moves
                  the compositor's transform. */}
              <motion.div
                ref={reader.columnsRef}
                className="font-reading"
                style={{
                  x: reader.x,
                  height: reader.columnHeight > 0 ? reader.columnHeight : "100%",
                  columnWidth: reader.columnWidth ? `${reader.columnWidth}px` : undefined,
                  columnGap: `${COLUMN_GAP}px`,
                  // "auto" fills each column before starting the next; the
                  // default "balance" evens them out and breaks pagination.
                  columnFill: "auto",
                  willChange: "transform",
                }}
              >
                {body}
              </motion.div>
            </div>
          </div>
        ) : (
          <article className="mx-auto w-full max-w-[70ch] py-6 font-reading">{body}</article>
        )}
      </div>
      </div>

      {/* Page controls. */}
      {paged && (
        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 bg-[#0e0e0e] px-4 py-2.5">
          <button
            onClick={goPrev}
            disabled={page === 0}
            aria-label="Previous page"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="mx-auto h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-all duration-300"
                style={{ width: `${((page + 1) / pageCount) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40 tabular-nums">
              Page {page + 1} of {pageCount}
            </p>
          </div>

          <button
            onClick={goNext}
            disabled={page >= pageCount - 1}
            aria-label="Next page"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-25"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Deleting the text of a 12,000 word summary that took minutes to write
          is worth one question, especially when the button sits next to
          Regenerate. */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161616] p-5">
            <h3 className="font-bold text-white">Delete this summary?</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              The written text goes, and re-generating it takes a few minutes.{" "}
              <span className="text-white/80">{summary.title}</span> stays in the library either way.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-full border border-white/20 py-2.5 text-sm font-bold text-white/80"
              >
                Keep it
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex-1 rounded-full bg-[#FF006E] py-2.5 text-sm font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Scroll-mode fallback for a contents jump. */
function scrollToSection(i: number) {
  document
    .getElementById(`summary-section-${i}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Debounced position reporting.
 *
 * The reader turns a page roughly every 40 seconds and lands on 60 of them, so
 * writing on every turn would be 60 Firestore writes per read for information
 * that only matters when the reader leaves. Waiting for the page to sit still
 * collapses a burst of flicking through the book into a single write.
 */
function usePersistProgress(onProgress: (progress: number, complete: boolean) => void) {
  const cbRef = useRef(onProgress);
  cbRef.current = onProgress;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return useCallback((page: number, pageCount: number) => {
    // A page count of 1 means the text has not been laid out yet. Saving here
    // would write progress 0 over a real saved position before the reader has
    // even been put back where they were.
    if (pageCount <= 1) return;

    const value = page / (pageCount - 1);
    const complete = page >= pageCount - 1;

    if (
      !complete &&
      lastSaved.current !== null &&
      Math.abs(value - lastSaved.current) < PROGRESS_EPSILON
    ) {
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastSaved.current = value;
      cbRef.current(value, complete);
    }, PROGRESS_SAVE_DELAY);
  }, []);
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-bold transition-all ${
        active
          ? "border-[#00D4FF] bg-[#00D4FF]/10 text-white"
          : "border-white/10 text-white/50 hover:border-white/25"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
