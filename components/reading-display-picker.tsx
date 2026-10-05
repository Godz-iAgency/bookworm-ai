"use client";

import { BookOpen, ScrollText } from "lucide-react";
import { FONT_SCALE, FONT_SIZE_ORDER, type ReadingFontSize, type ReadingMode } from "@/lib/reading-prefs";

/**
 * Text size and lesson layout (scroll or pages), with a live sample in the real
 * reading font. Shared by the Profile screen and the last onboarding step, so a
 * new reader chooses exactly what they will later find in Profile.
 */
export function ReadingDisplayPicker({
  fontSize,
  readingMode,
  onFontSize,
  onReadingMode,
}: {
  fontSize: ReadingFontSize;
  readingMode: ReadingMode;
  onFontSize: (size: ReadingFontSize) => void;
  onReadingMode: (mode: ReadingMode) => void;
}) {
  const option = (on: boolean) =>
    on
      ? "border-[#00D4FF] bg-[#00D4FF]/10 text-white shadow-[0_0_14px_rgba(0,212,255,0.2)]"
      : "border-white/10 text-white/50 hover:border-white/25";

  return (
    <>
      <p className="mb-2 text-xs font-bold text-white/70">Text size</p>
      <div className="flex gap-2">
        {FONT_SIZE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onFontSize(id)}
            aria-pressed={fontSize === id}
            className={`flex flex-1 flex-col items-center justify-end gap-1 rounded-xl border py-2.5 transition-all ${option(fontSize === id)}`}
          >
            <span className="font-reading font-bold leading-none" style={{ fontSize: FONT_SCALE[id].body }}>
              A
            </span>
            <span className="text-[0.625rem] font-bold uppercase tracking-wide">{FONT_SCALE[id].label}</span>
          </button>
        ))}
      </div>

      {/* Live sample in the real reading font, so the choice is visible
          here instead of only after opening a lesson. */}
      <p
        className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3.5 py-3 font-reading text-white/80"
        style={{ fontSize: FONT_SCALE[fontSize].body, lineHeight: FONT_SCALE[fontSize].lineHeight }}
      >
        The universe conspires to help you achieve your Personal Legend.
      </p>

      <p className="mb-2 mt-5 text-xs font-bold text-white/70">Lesson layout</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onReadingMode("scroll")}
          aria-pressed={readingMode === "scroll"}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${option(readingMode === "scroll")}`}
        >
          <ScrollText className="h-4 w-4" strokeWidth={2} />
          Scroll
        </button>
        <button
          type="button"
          onClick={() => onReadingMode("page")}
          aria-pressed={readingMode === "page"}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold transition-all ${option(readingMode === "page")}`}
        >
          <BookOpen className="h-4 w-4" strokeWidth={2} />
          Pages
        </button>
      </div>
      <p className="mt-2 text-[0.6875rem] leading-snug text-white/40">
        {readingMode === "page"
          ? "Swipe or tap the arrows to turn pages, like a real book."
          : "One continuous page you scroll through."}
      </p>
    </>
  );
}
