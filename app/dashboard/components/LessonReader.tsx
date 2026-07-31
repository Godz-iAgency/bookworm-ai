"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X, Check, BookOpen, ScrollText } from "lucide-react";
import { parseLesson } from "@/lib/lesson";
import { useReadingPrefs } from "@/lib/ReadingPrefsContext";
import { FONT_SCALE, FONT_SIZE_ORDER } from "@/lib/reading-prefs";

// Gutter between columns. Doubles as the gutter between facing pages in a
// spread, so it has to be part of the page-width arithmetic or the pages drift
// out of alignment as you turn.
const COLUMN_GAP = 48;

// Horizontal distance that counts as a page turn rather than a stray touch.
const SWIPE_THRESHOLD = 45;

// Vertical breathing room above and below the text block, in px.
const PAGE_PAD_Y = 20;

/**
 * Above this reading width a page becomes a two-column spread, the way a
 * physical book opens flat. A Galaxy Tab 10 in landscape gives roughly 1216px
 * of reading width, which as a single column would be a ~120-character line
 * (unreadable) or a 672px column stranded in the middle of the screen. Split in
 * two it is a pair of ~585px columns: a proper book measure that also uses the
 * whole tablet. Portrait tablets (~736px) stay single-column.
 */
const SPREAD_MIN_WIDTH = 900;

/** Single-column measure cap, ~70 characters. */
const MAX_SINGLE_WIDTH = 672;

/** Spread cap, so a wide desktop doesn't produce two enormous columns. */
const MAX_SPREAD_WIDTH = 1400;

interface LessonReaderProps {
  dayNumber: number;
  dayTitle: string;
  lesson: string;
  /** Rendered above the lesson (the Day 1 expiry note). */
  intro?: ReactNode;
  /** True while this is the reader's current day, so completing it is offered. */
  canComplete: boolean;
  onComplete: () => void;
  onClose: () => void;
}

/**
 * Full-bleed lesson reader. Takes over the whole content area so a lesson reads
 * like a book rather than like a paragraph inside a card, and supports both
 * continuous scrolling and Kindle-style page turns.
 *
 * Pagination uses CSS multi-column rather than measuring and slicing the text
 * ourselves: the browser reflows the lesson into page-height columns, and we
 * translate horizontally by one page at a time. That keeps page breaks on real
 * line boundaries and re-paginates for free whenever the text size or the
 * viewport changes.
 */
export default function LessonReader({
  dayNumber,
  dayTitle,
  lesson,
  intro,
  canComplete,
  onComplete,
  onClose,
}: LessonReaderProps) {
  const { fontSize, readingMode, setFontSize, setReadingMode } = useReadingPrefs();
  const scale = FONT_SCALE[fontSize];
  const paged = readingMode === "page";

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  // Size of the padding-free box the pages are laid out inside.
  const [frame, setFrame] = useState({ w: 0, h: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const blocks = parseLesson(lesson);

  // ---- Page geometry -------------------------------------------------------
  // Derived, never stored: every value here follows from the frame size and the
  // reader's chosen text size, so a rotation or a size change re-paginates with
  // no stale state to invalidate.
  const spread = paged && frame.w >= SPREAD_MIN_WIDTH;
  const columnsPerPage = spread ? 2 : 1;
  const columnWidth = spread
    ? Math.floor((Math.min(frame.w, MAX_SPREAD_WIDTH) - COLUMN_GAP) / 2)
    : Math.min(frame.w, MAX_SINGLE_WIDTH);
  // The visible page: one column, or two columns plus the gutter between them.
  const pageWidth = columnWidth * columnsPerPage + COLUMN_GAP * (columnsPerPage - 1);

  // Trim the column box down to a whole number of body lines. Without this the
  // box usually ends part-way through a line's leading, leaving an uneven strip
  // of half-height whitespace that makes each page look accidentally cropped.
  const lineHeightPx = scale.body * scale.lineHeight;
  const availableHeight = frame.h - PAGE_PAD_Y * 2;
  const columnHeight =
    availableHeight > lineHeightPx
      ? Math.floor(availableHeight / lineHeightPx) * lineHeightPx
      : availableHeight;

  // Track the reading area's size. Page geometry is derived from it, so this
  // has to survive rotation, browser-chrome collapse and split-screen resizes.
  //
  // ResizeObserver is the primary signal because the area can change without
  // the window doing so (opening this panel, for one). The window listeners are
  // a deliberate backstop: on mobile browsers a rotation can settle the new
  // viewport a frame later than the observer reports, which would otherwise
  // leave the columns sized for the old orientation.
  useEffect(() => {
    if (!paged) return;
    const update = () => {
      const el = frameRef.current;
      if (!el) return;
      setFrame((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight
          ? prev
          : { w: el.clientWidth, h: el.clientHeight }
      );
    };
    update();

    const ro = new ResizeObserver(update);
    if (frameRef.current) ro.observe(frameRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
    // settingsOpen re-runs this because opening the panel shortens the reading
    // area, which must re-paginate even though the window never resized.
  }, [paged, settingsOpen]);

  // Count pages once the columns have actually been laid out at the current
  // size. Runs after paint (rAF) because scrollWidth is only meaningful then,
  // and again after webfonts land since Lora reflows the text when it swaps in.
  useEffect(() => {
    if (!paged || !columnWidth) return;
    let cancelled = false;
    const count = () => {
      const col = columnsRef.current;
      if (cancelled || !col) return;
      // scrollWidth spans every column the text flowed into, including the ones
      // overflowing past the clipped page box.
      const totalColumns = Math.max(
        1,
        Math.round((col.scrollWidth + COLUMN_GAP) / (columnWidth + COLUMN_GAP))
      );
      setPageCount(Math.max(1, Math.ceil(totalColumns / columnsPerPage)));
    };
    const raf = requestAnimationFrame(count);
    document.fonts?.ready.then(count).catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [paged, columnWidth, columnsPerPage, columnHeight, fontSize, lesson]);

  // Never strand the reader past the last page after a resize or a size bump.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  // A different day is a different book chapter: always start at page one.
  useEffect(() => {
    setPage(0);
  }, [lesson]);

  const goPrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setPage((p) => Math.min(pageCount - 1, p + 1)), [pageCount]);

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

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx <= -SWIPE_THRESHOLD) goNext();
    if (dx >= SWIPE_THRESHOLD) goPrev();
  };

  // Shared typography for both modes, so switching between them changes only
  // how the text is advanced, never how it looks.
  const body = (
    <>
      {intro && <div style={{ breakInside: "avoid" }}>{intro}</div>}
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h4
              key={i}
              className="font-bold text-white"
              style={{
                fontSize: scale.heading,
                lineHeight: 1.35,
                marginTop: i === 0 ? 0 : "1.6em",
                marginBottom: "0.5em",
                // A heading alone at the foot of a page reads as a mistake.
                breakInside: "avoid",
                breakAfter: "avoid",
              }}
            >
              {b.text}
            </h4>
          );
        }
        return (
          <p
            key={i}
            className="text-white/85"
            style={{
              fontSize: scale.body,
              lineHeight: scale.lineHeight,
              marginBottom: b.type === "item" ? "0.5em" : "1.1em",
            }}
          >
            {b.text}
          </p>
        );
      })}
    </>
  );

  return (
    <div className="flex h-full w-full flex-col animate-in fade-in duration-300">
      {/* Reader chrome — deliberately thin so the text gets the screen. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0e0e0e] px-4 py-2.5">
        <button
          onClick={onClose}
          aria-label="Close lesson"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">Day {dayNumber}</p>
          <p className="truncate text-sm font-bold text-white">{dayTitle}</p>
        </div>
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          aria-label="Reading settings"
          aria-expanded={settingsOpen}
          className={`flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 transition-colors ${
            settingsOpen
              ? "border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]"
              : "border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="text-xs font-black">A</span>
          <span className="text-base font-black leading-none">A</span>
        </button>
      </div>

      {/* Quick settings — the same two controls that live in Profile, within
          reach while reading so adjusting size doesn't mean leaving the page. */}
      {settingsOpen && (
        <div className="shrink-0 border-b border-white/10 bg-[#141414] px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="mx-auto flex max-w-md flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40">Size</span>
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
                    <span style={{ fontSize: 10 + FONT_SIZE_ORDER.indexOf(id) * 3 }} className="font-bold">
                      A
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/40">Layout</span>
              <div className="flex flex-1 gap-1.5">
                <ModeButton
                  active={!paged}
                  onClick={() => setReadingMode("scroll")}
                  icon={<ScrollText className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="Scroll"
                />
                <ModeButton
                  active={paged}
                  onClick={() => setReadingMode("page")}
                  icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={2} />}
                  label="Pages"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reading surface. The max-width is generous but not unlimited: past
          roughly 70 characters a line the eye loses its place on the return
          sweep, which is why physical books are the width they are. */}
      <div
        className={`min-h-0 flex-1 px-5 md:px-8 ${paged ? "overflow-hidden" : "overflow-y-auto"}`}
        onTouchStart={paged ? onTouchStart : undefined}
        onTouchEnd={paged ? onTouchEnd : undefined}
      >
        {paged ? (
          // frameRef is the padding-free measuring box; the page box inside it
          // is sized to exactly one page so the columns clip on a page boundary.
          <div ref={frameRef} className="h-full w-full">
            <div
              className="mx-auto h-full overflow-hidden"
              style={{
                width: pageWidth || "100%",
                paddingTop: PAGE_PAD_Y,
                paddingBottom: PAGE_PAD_Y,
              }}
            >
              <div
                ref={columnsRef}
                className="font-reading"
                style={{
                  height: columnHeight > 0 ? columnHeight : "100%",
                  columnWidth: columnWidth ? `${columnWidth}px` : undefined,
                  columnGap: `${COLUMN_GAP}px`,
                  // "auto" fills each column before starting the next; the
                  // default "balance" evens them out and breaks pagination.
                  columnFill: "auto",
                  transform: `translateX(-${page * (pageWidth + COLUMN_GAP)}px)`,
                  transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                {body}
              </div>
            </div>
          </div>
        ) : (
          <article className="mx-auto w-full max-w-[70ch] font-reading py-6">
            {body}
            {canComplete && (
              <button
                onClick={onComplete}
                className="mb-4 mt-8 w-full rounded-xl bg-white px-8 py-3.5 font-bold text-black transition-transform hover:scale-[1.01]"
              >
                ✓ Mark Day {dayNumber} Complete
              </button>
            )}
          </article>
        )}
      </div>

      {/* Page controls. Scroll mode has its own inline Complete button at the
          end of the text, so this bar is page mode only. */}
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

          {/* On the last page the forward arrow becomes the completion action,
              so finishing a lesson is the same gesture as turning a page. */}
          {canComplete && page === pageCount - 1 ? (
            <button
              onClick={onComplete}
              aria-label={`Mark day ${dayNumber} complete`}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-bold text-black transition-transform hover:scale-105"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              Done
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={page >= pageCount - 1}
              aria-label="Next page"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-25"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
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
