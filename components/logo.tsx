import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Bookworm.AI logo, in the three forms the app actually needs.
 *
 * This replaces fifteen hand-placed copies of a single square lockup file.
 * That file was 1024x1024 and contained the mark, the wordmark and the
 * tagline baked together, but call sites rendered it into boxes like 76x20 —
 * a 3.8:1 slot for a 1:1 image. The browser squashed it, and the tagline
 * inside ended up about three pixels tall, which is why it read as an
 * unidentifiable smudge on a phone.
 *
 * The pieces are separate now, so each variant can be sized honestly:
 *
 *   mark     the symbol alone. Square. For tight slots — app bars, buttons.
 *   lockup   mark beside the wordmark. For page headers with room to spare.
 *   stacked  mark above the wordmark, optionally above the tagline. For
 *            landing and auth pages, where the brand is the focus.
 *
 * The tagline is real text rather than the supplied image on purpose. The
 * export is near-black (rgb(45,51,62)) on transparency, which is invisible
 * against this app's #080808 background — and thin lettering rasterised down
 * to 11px turns to mush anyway. As text it stays sharp at any size, takes a
 * colour that can actually be read, and is available to screen readers.
 */

export const TAGLINE = "Making every book smarter";

type LogoVariant = "mark" | "lockup" | "stacked";

interface LogoProps {
  variant?: LogoVariant;
  /**
   * Mark height in pixels, for `mark` and `lockup`. Ignored by `stacked`,
   * which scales to whatever width its container gives it — pass that through
   * className (e.g. `w-56 sm:w-72`).
   */
  size?: number;
  /** Only honoured by `stacked`; the other variants are too small to read it. */
  tagline?: boolean;
  className?: string;
  priority?: boolean;
  /**
   * Decorative uses (next to a visible "Bookworm.AI" heading, or inside a
   * button that already has an aria-label) should pass an empty alt so the
   * name is not announced twice.
   */
  alt?: string;
}

/** Intrinsic ratio of the trimmed wordmark, so height drives width honestly. */
const WORDMARK_RATIO = 1638 / 160;

export function Logo({
  variant = "lockup",
  size = 32,
  tagline = false,
  className,
  priority = false,
  alt = "Bookworm.AI",
}: LogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/mark.png"
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className={cn("shrink-0", className)}
      />
    );
  }

  if (variant === "lockup") {
    // The wordmark sits a little under half the mark's height: matched by eye
    // to the cap height rather than the full square, which otherwise makes the
    // lettering look oversized next to the symbol.
    const wordHeight = Math.round(size * 0.42);
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <Image
          src="/brand/mark.png"
          alt={alt}
          width={size}
          height={size}
          priority={priority}
          className="shrink-0"
        />
        <Image
          src="/brand/wordmark.png"
          alt=""
          width={Math.round(wordHeight * WORDMARK_RATIO)}
          height={wordHeight}
          priority={priority}
          className="shrink-0"
        />
      </span>
    );
  }

  // stacked — width comes from the container, so every part keeps its ratio
  // no matter how narrow the phone is.
  return (
    <span className={cn("inline-flex flex-col items-center", className)}>
      <Image
        src="/brand/mark.png"
        alt={alt}
        width={512}
        height={512}
        priority={priority}
        className="h-auto w-[44%]"
      />
      <Image
        src="/brand/wordmark.png"
        alt=""
        width={1638}
        height={160}
        priority={priority}
        className="mt-3 h-auto w-full"
      />
      {/* /70 rather than something dimmer: on the landing page this sits over
          the animated particle field, and anything lighter starts competing
          with the dots behind it. Legibility is the entire reason the tagline
          is text instead of the near-black supplied image. */}
      {tagline && (
        <span className="mt-2 text-center text-[11px] font-medium tracking-wide text-white/70 sm:text-xs">
          {TAGLINE}
        </span>
      )}
    </span>
  );
}
