import { scriptGlitches, splitLesson } from "./lesson";

/** Validate provider output before any reader receives it. */

/**
 * The floor for one day's main lesson, in instructional words. The prompt aims
 * for about 2,500: roughly ten minutes at an adult's average non-fiction
 * reading speed (238 words a minute), about twelve at a study pace. At that
 * length Flash-Lite writes a lesson in one pass rather than being padded out.
 */
export const MIN_LESSON_WORDS = 2200;

const text = (v: any): boolean => typeof v === "string" && v.trim().length > 0;

/**
 * Words that actually teach. Section headings and the closing 24-hour actions
 * are not counted; flashcards, starters and the axiom live outside the lesson
 * text entirely.
 */
export function instructionalWordCount(lesson: string): number {
  return splitLesson(lesson)
    .blocks.filter((b) => b.type !== "heading")
    .reduce((n, b) => n + b.text.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * The shape a lesson needs before its length is worth measuring: its sections,
 * and exactly three closing actions for the 24-hour checklist. A lesson
 * missing these is regenerated, since added depth cannot supply them.
 */
export function lessonStructureProblem(lesson: string): string | null {
  if (!text(lesson)) return "Lesson is empty.";
  const { blocks, actions, actionsHeading } = splitLesson(lesson);
  const headings = blocks.filter((b) => b.type === "heading").length + (actionsHeading ? 1 : 0);
  if (headings < 5) return "Lesson is missing its sections.";
  if (actions.length !== 3) return `Lesson has ${actions.length} closing actions, not 3.`;
  return null;
}

const clean = (v: any) => text(v) && scriptGlitches(v).length === 0;

export function validDeck(value: any): boolean {
  return Array.isArray(value) && value.length === 3 && value.every(c => c && clean(c.front) && clean(c.back));
}

export function validStudyAids(value: any): boolean {
  return !!value && validDeck(value.flashcards) && clean(value.closingAxiom) && Array.isArray(value.chatSeed) && value.chatSeed.length === 3 && value.chatSeed.every(clean);
}

/** A complete day: a full-length, well-formed lesson and everything built from it. */
export function validLesson(value: any): boolean {
  return !!value && clean(value.lesson) && !lessonStructureProblem(value.lesson) && instructionalWordCount(value.lesson) >= MIN_LESSON_WORDS && validStudyAids(value);
}

/** One day of the plan: what it teaches, before any lesson exists. */
export function validOutlineDay(d: any, i: number): boolean {
  return !!d && text(d.title) && (d.dayNumber === undefined || d.dayNumber === i + 1) && text(d.previewText) && text(d.coreConcept) && text(d.learningObjective) && text(d.bookConnection) && Array.isArray(d.keyIdeas) && d.keyIdeas.filter(text).length >= 3;
}

export function validOutline(value: any): boolean {
  return Array.isArray(value?.days) && value.days.length === 7 && value.days.every(validOutlineDay);
}
