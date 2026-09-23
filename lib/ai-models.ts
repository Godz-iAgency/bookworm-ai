/**
 * Every model name and per-task model setting, in one place, so a model swap
 * is one edit here rather than a search through the routes.
 *
 * The split: the full lesson model decides HOW a day is taught (the deep,
 * long-form lesson itself). The lite model does everything around it,
 * including deciding WHAT each day teaches (the outline), which is cheap and
 * fast to produce but has to be right.
 */
export const LESSON_MODEL = "gemini-3.8-flash";
export const LITE_MODEL = "gemini-3.5-flash-lite";

/**
 * Gemini 3 models take a thinking level instead of the older token budget.
 * 3.8 Flash cannot go below "low" ("minimal" is rejected); Flash-Lite accepts
 * "minimal". Thinking tokens count against maxOutputTokens, so every task's
 * output ceiling has to leave room for them.
 */
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

export interface AiTask {
  /** Short label for logs, so each line says which job ran on which model. */
  name: string;
  model: string;
  thinking: ThinkingLevel;
  /** Longest one provider call may run before it is abandoned. */
  callTimeoutMs: number;
  /**
   * Extra Gemini attempts after a brief overload (503) or rate limit (429),
   * before the Groq fallback is used. Google's "high demand" 503 usually
   * clears in seconds, and a lesson written by the fallback is a worse lesson.
   */
  geminiRetries: number;
  /**
   * A second Gemini model to try when the first is overloaded or out of quota,
   * before Groq. For lessons this matters: Groq cannot write a full-length
   * lesson, and Flash-Lite can.
   */
  fallbackModel?: string;
}

export const AI_TASKS = {
  /** One day's full lesson, 3,000+ words. */
  lesson: { name: "lesson", model: LESSON_MODEL, thinking: "low", callTimeoutMs: 170_000, geminiRetries: 3, fallbackModel: LITE_MODEL },
  /** Adds depth to a lesson that came back short, without rewriting it. */
  lessonExpand: { name: "lesson-expand", model: LESSON_MODEL, thinking: "low", callTimeoutMs: 75_000, geminiRetries: 2, fallbackModel: LITE_MODEL },
  /** The 7-day plan: what each day teaches. Worth real thinking. */
  outline: { name: "outline", model: LITE_MODEL, thinking: "medium", callTimeoutMs: 80_000, geminiRetries: 2 },
  /** Flashcards, chat starters and the closing axiom, drawn from a lesson. */
  studyAids: { name: "study-aids", model: LITE_MODEL, thinking: "low", callTimeoutMs: 55_000, geminiRetries: 2 },
  // Even a one-word Flash-Lite reply was measured anywhere from 1 to 30 seconds
  // under load, so these small tasks still get a generous ceiling.
  axiom: { name: "axiom", model: LITE_MODEL, thinking: "minimal", callTimeoutMs: 45_000, geminiRetries: 1 },
  chat: { name: "chat", model: LITE_MODEL, thinking: "minimal", callTimeoutMs: 45_000, geminiRetries: 1 },
  coverScan: { name: "cover-scan", model: LITE_MODEL, thinking: "minimal", callTimeoutMs: 45_000, geminiRetries: 1 },
} satisfies Record<string, AiTask>;
