"use client";

/**
 * The page-turning engine, shared by the 7-day lesson reader and the Personal
 * Development summary reader.
 *
 * Pagination uses CSS multi-column rather than measuring and slicing the text
 * ourselves: the browser reflows the content into page-height columns and we
 * translate horizontally by one page at a time. That keeps page breaks on real
 * line boundaries and re-paginates for free whenever the text size or the
 * viewport changes, which is the whole reason a 60-page summary can be read at
 * four different text sizes without any of this knowing how long it is.
 *
 * Extracted from LessonReader so both readers turn pages identically. A summary
 * that flipped differently from a lesson would read as two different apps.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useMotionValue, animate, useReducedMotion, type MotionValue } from "motion/react";

/**
 * Gutter between columns. Doubles as the gutter between facing pages in a
 * spread, so it has to be part of the page-width arithmetic or the pages drift
 * out of alignment as you turn.
 */
export const COLUMN_GAP = 48;

/** Vertical breathing room above and below the text block, in px. */
export const PAGE_PAD_Y = 20;

/**
 * Movement before a horizontal drag is treated as a page turn at all, so a tap
 * or a slightly-off vertical scroll doesn't start dragging the page.
 */
const DRAG_HYSTERESIS = 10;

/**
 * Deceleration constant for momentum projection, matching the value Apple use
 * for normal scroll feel. Higher means a flick coasts further.
 */
const DECELERATION = 0.998;

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

/**
 * A jump further than this animates through the intervening pages, which at a
 * table-of-contents distance reads as a blur rather than a turn. Long jumps cut
 * straight to the destination instead.
 */
const MAX_ANIMATED_JUMP = 3;

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

export interface PagedReaderOptions {
  /** False in scroll mode: no measuring, no gesture, no page state churn. */
  enabled: boolean;
  /** Body line height in px, used to trim the page box to whole lines. */
  lineHeightPx: number;
  /**
   * Re-measures the reading frame when this changes. Needed for anything that
   * resizes the frame without resizing the window, such as a settings panel
   * opening above the text.
   */
  remeasureKey?: unknown;
  /** Re-counts pages when this changes: new text, or a new text size. */
  contentKey?: unknown;
  /** Returns to the start when this changes: a different lesson or book. */
  resetKey?: unknown;
  /**
   * How far through the text to open, 0 to 1, applied once the page count is
   * first known for a given resetKey. A fraction rather than a page number on
   * purpose: page numbers are a function of viewport and text size, so a saved
   * page 34 means somewhere else entirely on a phone at Huge.
   */
  initialProgress?: number;
  /** Fires on every settled page change, for persisting reading position. */
  onPageChange?: (page: number, pageCount: number) => void;
}

export interface PagedReader {
  /** Wrap the padding-free measuring box. */
  frameRef: React.RefObject<HTMLDivElement | null>;
  /** Wrap the multi-column content stack. */
  columnsRef: React.RefObject<HTMLDivElement | null>;
  /** Bind to the column stack's `x`. */
  x: MotionValue<number>;
  page: number;
  pageCount: number;
  /** True while a finger is actively dragging the page. */
  isDragging: () => boolean;
  goPrev: () => void;
  goNext: () => void;
  /** Jump to an arbitrary page, for a table of contents. */
  jumpTo: (page: number) => void;
  /** Layout offset of a page boundary, for mapping elements back to pages. */
  stride: number;
  /** Styles for the page box and the column stack. */
  pageWidth: number;
  columnWidth: number;
  columnHeight: number;
  spread: boolean;
  /** Spread on the pointer surface, along with `touchAction: "pan-y"`. */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function usePagedReader({
  enabled,
  lineHeightPx,
  remeasureKey,
  contentKey,
  resetKey,
  initialProgress = 0,
  onPageChange,
}: PagedReaderOptions): PagedReader {
  const reduceMotion = useReducedMotion();

  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  // Size of the padding-free box the pages are laid out inside.
  const [frame, setFrame] = useState({ w: 0, h: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  // The live horizontal offset of the column stack. A motion value rather than
  // React state on purpose: it is written on every pointermove and must not
  // re-render the text to move the page.
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

  // Held in a ref so the seek effect can read the latest value without
  // re-running every time the caller re-renders with a new closure.
  const seek = useRef({ pending: true, progress: initialProgress });
  seek.current.progress = initialProgress;

  // Bumped on every reset, so the effect that applies a saved position runs even
  // when new content happens to paginate to exactly the same number of pages.
  const [resetToken, setResetToken] = useState(0);

  // The page count the current `page` was measured against. Re-pagination is
  // detected by comparing against it.
  const lastCount = useRef(0);

  const changeRef = useRef(onPageChange);
  changeRef.current = onPageChange;

  // ---- Page geometry -------------------------------------------------------
  // Derived, never stored: every value here follows from the frame size and the
  // reader's chosen text size, so a rotation or a size change re-paginates with
  // no stale state to invalidate.
  const spread = enabled && frame.w >= SPREAD_MIN_WIDTH;
  const columnsPerPage = spread ? 2 : 1;
  const columnWidth = spread
    ? Math.floor((Math.min(frame.w, MAX_SPREAD_WIDTH) - COLUMN_GAP) / 2)
    : Math.min(frame.w, MAX_SINGLE_WIDTH);
  // The visible page: one column, or two columns plus the gutter between them.
  const pageWidth = columnWidth * columnsPerPage + COLUMN_GAP * (columnsPerPage - 1);

  // Trim the column box down to a whole number of body lines. Without this the
  // box usually ends part-way through a line's leading, leaving an uneven strip
  // of half-height whitespace that makes each page look accidentally cropped.
  const availableHeight = frame.h - PAGE_PAD_Y * 2;
  const columnHeight =
    availableHeight > lineHeightPx
      ? Math.floor(availableHeight / lineHeightPx) * lineHeightPx
      : availableHeight;

  // Distance from one page to the next, gutter included.
  const stride = pageWidth + COLUMN_GAP;
  const offsetForPage = useCallback((p: number) => -p * stride, [stride]);

  // Track the reading area's size. Page geometry is derived from it, so this
  // has to survive rotation, browser-chrome collapse and split-screen resizes.
  //
  // ResizeObserver is the primary signal because the area can change without
  // the window doing so (opening a panel, for one). The window listeners are a
  // deliberate backstop: on mobile browsers a rotation can settle the new
  // viewport a frame later than the observer reports, which would otherwise
  // leave the columns sized for the old orientation.
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, remeasureKey]);

  // Count pages once the columns have actually been laid out at the current
  // size. Runs after paint (rAF) because scrollWidth is only meaningful then,
  // and again after webfonts land since Lora reflows the text when it swaps in.
  useEffect(() => {
    if (!enabled || !columnWidth) return;
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
  }, [enabled, columnWidth, columnsPerPage, columnHeight, contentKey]);

  // A different lesson or book starts again from the front, and re-arms the
  // seek so a saved position gets applied to the new text.
  useEffect(() => {
    seek.current.pending = true;
    lastCount.current = 0;
    setPage(0);
    setResetToken((t) => t + 1);
  }, [resetKey]);

  /**
   * Keep the reader in the same place in the book whenever the pagination
   * changes underneath them.
   *
   * Three different situations land here and they must not be confused:
   *
   * - The first count after opening a book: put the reader back where they
   *   stopped, resolving the saved fraction against a page count that only
   *   exists now that the text has been laid out.
   *
   * - A re-pagination mid-read (bumping the text size, rotating the tablet,
   *   opening the contents panel): the page *number* is meaningless across it.
   *   Going from 102 pages to 173 while sitting on page 43 has to move the
   *   reader to page 73, not leave them on 43, which would silently throw them
   *   thirty pages back into text they had already read. The fraction is the
   *   thing being preserved; the page number is just how it is expressed.
   *
   * - A count that shrank: never strand the reader past the end.
   */
  useEffect(() => {
    if (!enabled || pageCount <= 0) return;
    const previous = lastCount.current;
    lastCount.current = pageCount;

    if (seek.current.pending) {
      seek.current.pending = false;
      const target = Math.round(seek.current.progress * (pageCount - 1));
      setPage(Math.max(0, Math.min(pageCount - 1, target)));
      return;
    }

    if (previous > 1 && pageCount !== previous) {
      setPage((p) => {
        const fraction = p / (previous - 1);
        return Math.max(0, Math.min(pageCount - 1, Math.round(fraction * (pageCount - 1))));
      });
      return;
    }

    setPage((p) => Math.min(p, pageCount - 1));
  }, [enabled, pageCount, resetToken]);

  // Report settled positions outward, for persisting reading progress.
  useEffect(() => {
    if (!enabled) return;
    changeRef.current?.(page, pageCount);
  }, [enabled, page, pageCount]);

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
    (target: number, velocity = 0, allowAnimation = true) => {
      const clamped = Math.max(0, Math.min(pageCount - 1, target));
      setPage(clamped);

      if (reduceMotion || !allowAnimation) {
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

  const jumpTo = useCallback(
    (target: number) => {
      settleTo(target, 0, Math.abs(target - page) <= MAX_ANIMATED_JUMP);
    },
    [settleTo, page]
  );

  // Keep the offset correct when geometry changes under us (rotation, a text
  // size bump, a panel opening). No animation: nothing moved from the reader's
  // point of view, the page is simply a different width now.
  useEffect(() => {
    if (!enabled || drag.current.active) return;
    x.set(offsetForPage(page));
  }, [enabled, page, offsetForPage, x]);

  // ---- Drag to turn ---------------------------------------------------------
  // Pointer Events rather than touch events so a mouse and a stylus behave the
  // same as a finger, and with pointer capture so a drag that leaves the
  // element keeps tracking instead of stranding the page mid-turn.

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // button 0 covers touch, pen and a left mouse press; a right-click drag
      // should not turn pages.
      if (!enabled || e.button !== 0) return;
      const d = drag.current;
      d.active = true;
      d.committed = false;
      d.startX = e.clientX;
      d.startY = e.clientY;
      // Grabbing mid-flight takes over from wherever the page is right now, so
      // a turn can be caught and reversed without waiting for it to land.
      d.baseX = x.get();
      d.samples = [{ x: e.clientX, t: performance.now() }];
      animate(x, x.get(), { duration: 0 }).stop();
    },
    [enabled, x]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
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
    },
    [offsetForPage, pageCount, frame.w, stride, x]
  );

  const endDrag = useCallback(() => {
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
  }, [page, settleTo, stride, x]);

  const isDragging = useCallback(() => drag.current.active, []);

  return {
    frameRef,
    columnsRef,
    x,
    page,
    pageCount,
    isDragging,
    goPrev,
    goNext,
    jumpTo,
    stride,
    pageWidth,
    columnWidth,
    columnHeight,
    spread,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
