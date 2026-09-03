"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Check, BookOpen, ScrollText } from "lucide-react";
import { motion } from "motion/react";
import { parseLesson } from "@/lib/lesson";
import { useReadingPrefs } from "@/lib/ReadingPrefsContext";
import { FONT_SCALE, FONT_SIZE_ORDER } from "@/lib/reading-prefs";
import { usePagedReader, COLUMN_GAP, PAGE_PAD_Y } from "@/lib/usePagedReader";

interface LessonReaderProps {
  dayNumber: number;
  dayTitle: string;
  lesson: string;
  /**
   * Rendered as the last thing in the lesson, on its own page in paged mode.
   * Carries the handoff to tomorrow's day, so finishing a lesson ends on what
   * comes next rather than stopping dead.
   */
  outro?: ReactNode;
  /** True while this is the reader's current day, so completing it is offered. */
  canComplete: boolean;
  onComplete: () => void;
  onClose: () => void;
}

const PHONE_QUERY = "(max-width: 767px)";

/**
 * True on phone-width screens.
 *
 * The initial value is read from the viewport rather than defaulting to false.
 * That is safe here specifically because this component never exists in the
 * server-rendered HTML — it mounts only once a reader opens a day — so there is
 * no markup for it to disagree with. Defaulting to false instead would render
 * the in-flow layout for a frame and then swap to the overlay, restarting the
 * fade-in and flashing the dashboard's bars.
 *
 * 767px is one below Tailwind's `md`, so this and the `md:` classes elsewhere
 * in the app always describe the same two worlds.
 */
function useIsPhone() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches
  );

  // Keeps up with a rotation or a resized desktop window.
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isPhone;
}

/**
 * Full-bleed lesson reader. Takes over the whole content area so a lesson reads
 * like a book rather than like a paragraph inside a card, and supports both
 * continuous scrolling and Kindle-style page turns.
 *
 * The page geometry and the drag-to-turn gesture live in usePagedReader, shared
 * with the Personal Development summary reader.
 */
export default function LessonReader({
  dayNumber,
  dayTitle,
  lesson,
  outro,
  canComplete,
  onComplete,
  onClose,
}: LessonReaderProps) {
  const isPhone = useIsPhone();
  const { fontSize, readingMode, setFontSize, setReadingMode } = useReadingPrefs();
  const scale = FONT_SCALE[fontSize];
  const paged = readingMode === "page";

  const [settingsOpen, setSettingsOpen] = useState(false);

  const blocks = parseLesson(lesson);

  const reader = usePagedReader({
    enabled: paged,
    lineHeightPx: scale.body * scale.lineHeight,
    // The settings panel floats over the text rather than shortening it, so
    // opening it does not re-paginate and the reader keeps their exact page.
    // The outro is part of the key because it adds a page: without it the page
    // counter could be a page behind what the reader can actually turn to.
    contentKey: `${fontSize}|${lesson.length}|${outro ? 1 : 0}`,
    // A different day is a different chapter: always start at page one.
    resetKey: lesson,
  });
  const { page, pageCount, goPrev, goNext } = reader;

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

  // Shared typography for both modes, so switching between them changes only
  // how the text is advanced, never how it looks.
  const body = (
    <>
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
      {/* Starts its own page in paged mode: the handoff is a beat of its own,
          not a footnote crowded under the last paragraph of the lesson. */}
      {outro && <div style={{ breakBefore: "column", breakInside: "avoid" }}>{outro}</div>}
    </>
  );

  const shell = (
    <div
      className={
        isPhone
          ? "fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] text-white animate-in fade-in duration-300"
          : "flex h-full w-full flex-col animate-in fade-in duration-300"
      }
    >
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

      {/* Everything below the header shares one positioning context, so the
          settings panel can float over the text instead of pushing it. */}
      <div className="relative min-h-0 flex-1">
      {/* Quick settings — the same two controls that live in Profile, within
          reach while reading so adjusting size doesn't mean leaving the page.

          Overlaid rather than in the flow: as a sibling it shortened the reading
          area, so opening it re-paginated the lesson and moved the reader off
          the page they were on. */}
      {settingsOpen && (
        <>
          <div
            className="absolute inset-0 z-20"
            onClick={() => setSettingsOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 z-30 max-h-full overflow-y-auto border-b border-white/10 bg-[#141414] px-4 py-3 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200">
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
        </>
      )}

      {/* Reading surface. The max-width is generous but not unlimited: past
          roughly 70 characters a line the eye loses its place on the return
          sweep, which is why physical books are the width they are. */}
      <div
        // overscroll-contain: reaching the end of the lesson must not chain the
        // scroll into the dashboard sitting behind the overlay.
        className={`h-full px-5 md:px-8 ${paged ? "overflow-hidden" : "overflow-y-auto overscroll-contain"}`}
        // touch-action pan-y: the browser keeps vertical scrolling, we take
        // horizontal. Without it Chrome claims the gesture and the page never
        // follows the finger.
        style={paged ? { touchAction: "pan-y" } : undefined}
        {...(paged ? reader.pointerHandlers : {})}
      >
        {paged ? (
          // frameRef is the padding-free measuring box; the page box inside it
          // is sized to exactly one page so the columns clip on a page boundary.
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
                  turning a page never re-renders the lesson - it only moves
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

  /**
   * On a phone the reader is rendered straight into <body>.
   *
   * It used to sit in the tab content area, boxed between the dashboard's top
   * bar (back arrow, cover, title) and its Course/Chat/Learn nav. Together with
   * the reader's own header and page controls that is four bars around the
   * text, and on an 812px phone the lesson itself was left with a couple of
   * lines.
   *
   * `position: fixed` alone does not escape them: the tab wrapper carries
   * `animate-in`, which leaves an identity transform behind, and any transform
   * makes that element the containing block for fixed descendants — the reader
   * stayed pinned between the two bars. A portal leaves the DOM subtree
   * entirely, so no ancestor's transform, filter or backdrop-blur can trap it,
   * including ones added later. React context and events still flow normally,
   * because both follow the React tree rather than the DOM.
   *
   * Tablets keep the old in-flow layout: there the surrounding chrome costs a
   * small fraction of the screen, and hiding it would only add a tap to reach
   * Chat or Learn.
   */
  if (isPhone) return createPortal(shell, document.body);
  return shell;
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
