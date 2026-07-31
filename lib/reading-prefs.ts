/**
 * How the reader wants lessons presented: text size and scroll-vs-page.
 *
 * Both are stored on the user's profile doc so they follow the reader across
 * devices, and both are read by the lesson reader (LessonReader.tsx).
 */

export type ReadingFontSize = "sm" | "md" | "lg" | "xl";
export type ReadingMode = "scroll" | "page";

export const DEFAULT_FONT_SIZE: ReadingFontSize = "md";
export const DEFAULT_READING_MODE: ReadingMode = "scroll";

/**
 * Body/heading sizes in px. The old lesson body was 15px, which readers found
 * too small on both phones and tablets, so the scale starts above that and
 * "md" (the default) is a comfortable e-reader size.
 */
export const FONT_SCALE: Record<
  ReadingFontSize,
  { label: string; sample: string; body: number; heading: number; lineHeight: number }
> = {
  sm: { label: "Small", sample: "A", body: 16, heading: 19, lineHeight: 1.7 },
  md: { label: "Medium", sample: "A", body: 18, heading: 22, lineHeight: 1.75 },
  lg: { label: "Large", sample: "A", body: 21, heading: 25, lineHeight: 1.75 },
  xl: { label: "Huge", sample: "A", body: 24, heading: 29, lineHeight: 1.8 },
};

export const FONT_SIZE_ORDER: ReadingFontSize[] = ["sm", "md", "lg", "xl"];

/** Narrow an unknown Firestore value to a valid size, falling back to default. */
export function coerceFontSize(v: unknown): ReadingFontSize {
  return typeof v === "string" && v in FONT_SCALE ? (v as ReadingFontSize) : DEFAULT_FONT_SIZE;
}

/** Narrow an unknown Firestore value to a valid mode, falling back to default. */
export function coerceReadingMode(v: unknown): ReadingMode {
  return v === "scroll" || v === "page" ? v : DEFAULT_READING_MODE;
}
