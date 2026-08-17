"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X, Check, BookOpen, ScrollText } from "lucide-react";
import { motion, useMotionValue, animate, useReducedMotion } from "motion/react";
import { parseLesson } from "@/lib/lesson";
import { useReadingPrefs } from "@/lib/ReadingPrefsContext";
import { FONT_SCALE, FONT_SIZE_ORDER } from "@/lib/reading-prefs";

// Gutter between columns. Doubles as the gutter between facing pages in a
// spread, so it has to be part of the page-width arithmetic or the pages drift
// out of alignment as you turn.
const COLUMN_GAP = 48;

// Movement before a horizontal drag is treated as a page turn at all, so a
// tap or a slightly-off vertical scroll doesn't start dragging the page.
const DRAG_HYSTERESIS = 10;

/**
 * Deceleration constant for momentum projection, matching the value Apple use
 * for normal scroll feel. Higher means a flick coasts further.
 */
const DECELERATION = 0.998;

/**
 * Where a flick would come to rest, given its release velocity. This is the
 * exponential-decay projection UIScrollView uses, not the v^2/2a from physics
 * class: the point is to land where the gesture was *going*, so a fast flick
 * throws the page and a slow drag does not.
 */
function projectMomentum(velocity: number, deceleration = DECELERATION) {
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/**
 * Progressive resistance past the first and last page. A hard stop reads as
 * frozen; resistance that grows with distance reads as responsive but empty.
 */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  if (dimension <= 0) return 0;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

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
  const reduceMotion = useReducedMotion();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  // Size of the padding-free box the pages are laid out inside.
  const [frame, setFrame] = useState({ w: 0, h: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  // The live horizontal offset of the column stack. A motion value rather than
  // React state on purpose: it is written on every pointermove and must not
  // re-render the lesson to move the page.
  const x = useMotionValue(0);

  // Gesture bookkeeping. Refs, not state, for the same reason.
  const drag = useRef({
    active: false,
    committed: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    // Short history of recent positions, so release velocity comes from the
    // last few moves rather than one possibly-stationary final event.
    samples: [] as { x: number; t: number }[],
  });

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

  // Distance from one page to the next, gutter included.
  const stride = pageWidth + COLUMN_GAP;
  const offsetForPage = useCallback((p: number) => -p * stride, [stride]);

  /**
   * Animate to a page, optionally inheriting the gesture's velocity so there is
   * no seam between dragging and animating.
   *
   * Always springs from wherever the page currently *is* on screen, which is
   * what makes an interrupted turn resumable: motion re-targets from the live
   * value and blends the existing velocity rather than cutting to a new
   * animation and producing a visible jump.
   */
  const settleTo = useCallback(
    (target: number, velocity = 0) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, target));
      setPage(clamped);

      if (reduceMotion) {
        x.set(offsetForPage(clamped));
        return;
      }

      animate(x, offsetForPage(clamped), {
        type: "spring",
        velocity,
        // A page turn that the reader threw deserves a little overshoot; one
        // driven by a button or an arrow key does not, so bounce follows
        // whether the gesture actually carried momentum.
        bounce: Math.abs(velocity) > 50 ? 0.18 : 0,
        duration: 0.4,
      });
    },
    [pageCount, offsetForPage, reduceMotion, x]
  );

  const goPrev = useCallback(() => settleTo(page - 1), [settleTo, page]);
  const goNext = useCallback(() => settleTo(page + 1), [settleTo, page]);

  // Keep the offset correct when geometry changes under us (rotation, a text
  // size bump, the settings panel opening). No animation: nothing moved from
  // the reader's point of view, the page is simply a different width now.
  useEffect(() => {
    if (!paged || drag.current.active) return;
    x.set(offsetForPage(page));
  }, [paged, page, offsetForPage, x]);

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

  // ---- Drag to turn ---------------------------------------------------------
  // Pointer Events rather than touch events so a mouse and a stylus behave the
  // same as a finger, and with pointer capture so a drag that leaves the
  // element keeps tracking instead of stranding the page mid-turn.

  const onPointerDown = (e: React.PointerEvent) => {
    // button 0 covers touch, pen and a left mouse press; a right-click drag
    // should not turn pages.
    if (!paged || e.button !== 0) return;
    const d = drag.current;
    d.active = true;
    d.committed = false;
    d.startX = e.clientX;
    d.startY = e.clientY;
    // Grabbing mid-flight takes over from wherever the page is right now, so a
    // turn can be caught and reversed without waiting for it to land.
    d.baseX = x.get();
    d.samples = [{ x: e.clientX, t: performance.now() }];
    animate(x, x.get(), { duration: 0 }).stop();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.committed) {
      // Wait for a clear horizontal intent. Comparing against vertical travel
      // means a diagonal thumb swipe doesn't start turning pages.
      if (Math.abs(dx) < DRAG_HYSTERESIS || Math.abs(dx) <= Math.abs(dy)) return;
      d.committed = true;
      // Capture keeps tracking if the finger leaves the element mid-turn. It
      // throws when the pointer is no longer active (a cancelled touch, a
      // synthetic event), and losing capture is far better than losing the
      // whole gesture, so a failure here is not fatal.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Tracking continues without capture.
      }
    }

    d.samples.push({ x: e.clientX, t: performance.now() });
    if (d.samples.length > 5) d.samples.shift();

    // 1:1 with the finger inside the book, with resistance past either end.
    const raw = d.baseX + dx;
    const min = offsetForPage(pageCount - 1);
    const max = 0;
    let next = raw;
    if (raw > max) next = max + rubberband(raw - max, frame.w || stride);
    else if (raw < min) next = min - rubberband(min - raw, frame.w || stride);
    x.set(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const wasCommitted = d.committed;
    d.active = false;
    d.committed = false;
    if (!wasCommitted) return;

    // Velocity from the recent sample window, in px/s.
    const samples = d.samples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last && first ? last.t - first.t : 0;
    const velocity = dt > 0 ? ((last.x - first.x) / dt) * 1000 : 0;

    // Land where the throw was heading, not where the finger happened to lift.
    const projected = x.get() + projectMomentum(velocity);
    const projectedPage = Math.round(-projected / stride);

    // One page per gesture, at most.
    //
    // The projection above uses the deceleration constant tuned for scrolling,
    // where coasting a long way is the point. Pages are not scroll: a flick
    // that lands three pages on is a reader who has lost their place, and a
    // book that turns an unpredictable number of pages per swipe cannot be
    // aimed. Velocity still decides whether the turn commits at all or springs
    // back, and it still feeds the spring, so the throw keeps its weight
    // without becoming a guess.
    const target = Math.max(page - 1, Math.min(page + 1, projectedPage));

    settleTo(target, velocity);
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
        // touch-action pan-y: the browser keeps vertical scrolling, we take
        // horizontal. Without it Chrome claims the gesture and the page never
        // follows the finger.
        style={paged ? { touchAction: "pan-y" } : undefined}
        onPointerDown={paged ? onPointerDown : undefined}
        onPointerMove={paged ? onPointerMove : undefined}
        onPointerUp={paged ? endDrag : undefined}
        onPointerCancel={paged ? endDrag : undefined}
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
              {/* x is a motion value driven by the drag and the spring, so
                  turning a page never re-renders the lesson - it only moves
                  the compositor's transform. */}
              <motion.div
                ref={columnsRef}
                className="font-reading"
                style={{
                  x,
                  height: columnHeight > 0 ? columnHeight : "100%",
                  columnWidth: columnWidth ? `${columnWidth}px` : undefined,
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
