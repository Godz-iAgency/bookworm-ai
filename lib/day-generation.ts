import { AI_TASKS } from "./ai-models";
import {
  buildDayMessages,
  buildExpansionMessages,
  buildFlashcardsMessages,
  type CourseContext,
  type DayPlan,
} from "./course-prompts";
import { MIN_LESSON_WORDS, instructionalWordCount, lessonStructureProblem, validLesson, validStudyAids } from "./course-validation";
import { generateJson, generateText, type Generated } from "./generate";
import { stripEmDashes } from "./lesson";

/** Everything one day needs, and which model produced each part. */
export interface DayContent {
  lesson: string;
  flashcards: { front: string; back: string }[];
  chatSeed: string[];
  closingAxiom: string;
  wordCount: number;
  generatedBy: { lesson: string; expansion?: string; studyAids: string };
}

/**
 * Time allowances inside the routes' 300s limit. The lesson gets most of it.
 * Expansion rounds then use whatever time is left, less what the study aids
 * need, so a quick first draft leaves room for more rounds.
 */
const TOTAL_BUDGET_MS = 285_000;
const LESSON_BUDGET_MS = 170_000;
const STUDY_AIDS_BUDGET_MS = 55_000;
const EXPANSION_ROUND_MS = 60_000;
const MIN_EXPANSION_ROUND_MS = 15_000;
const MAX_EXPANSION_ROUNDS = 4;

const str = (v: any, max: number) => (typeof v === "string" ? v.slice(0, max).trim() : "");
const strList = (v: any, count: number, max: number) =>
  Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()).slice(0, count).map((s: string) => s.slice(0, max).trim()) : [];

const label = (g: Generated<unknown>) => `${g.provider}:${g.model}`;

/**
 * The lesson writer's inputs, from a request body. Accepts both the current
 * shape (an `arc` carrying each day's concept, plus this day's plan) and the
 * older one (`allTitles` and `keyIdeas` only), so a browser still running the
 * previous build, and courses planned before the richer outline existed, keep
 * working.
 */
export function dayInputFromBody(body: any): { ctx: CourseContext; day: DayPlan } | null {
  const dayNumber = Number(body?.dayNumber);
  const dayTitle = str(body?.dayTitle, 300);
  const title = str(body?.title, 500);
  if (!title || !dayTitle || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 7) return null;

  const richArc = Array.isArray(body.arc)
    ? body.arc.slice(0, 7).map((a: any) => ({ title: str(a?.title, 300), coreConcept: str(a?.coreConcept, 800) || undefined }))
    : [];
  const arc = richArc.length ? richArc : strList(body.allTitles, 7, 300).map((t) => ({ title: t }));

  return {
    ctx: {
      title,
      author: str(body.author, 300),
      readingLevel: str(body.readingLevel, 40),
      language: str(body.language, 10) || "en",
      thesis: str(body.thesis, 2000),
      frameworks: strList(body.frameworks, 12, 200),
      arc: arc.length ? arc : [{ title: dayTitle }],
    },
    day: {
      dayNumber,
      title: dayTitle,
      coreConcept: str(body.coreConcept, 800) || undefined,
      learningObjective: str(body.learningObjective, 800) || undefined,
      keyIdeas: strList(body.keyIdeas, 6, 400),
      bookConnection: str(body.bookConnection, 800) || undefined,
    },
  };
}

interface Section {
  heading: string;
  body: string[];
}

function toSections(lesson: string): { preamble: string[]; sections: Section[] } {
  const preamble: string[] = [];
  const sections: Section[] = [];
  for (const line of lesson.split(/\r?\n/)) {
    if (/^\s*##\s/.test(line)) sections.push({ heading: line.trim(), body: [] });
    else if (sections.length) sections[sections.length - 1].body.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

function fromSections({ preamble, sections }: { preamble: string[]; sections: Section[] }): string {
  const parts: string[] = [];
  const pre = preamble.join("\n").trim();
  if (pre) parts.push(pre);
  for (const s of sections) parts.push(`${s.heading}\n\n${s.body.join("\n").trim()}`);
  return parts.join("\n\n");
}

/**
 * Place the expansion's new paragraphs at the end of the sections they were
 * written for. The existing text is never touched, and nothing is ever added
 * to the final section, whose three numbered lines are the 24-hour actions.
 */
export function mergeAdditions(lesson: string, additions: any[]): string {
  const doc = toSections(lesson);
  const lastTeachingSection = doc.sections.length - 1;
  for (const a of additions) {
    const n = Number(a?.section);
    if (!Number.isInteger(n) || n < 1 || n > lastTeachingSection || typeof a?.text !== "string") continue;
    const text = a.text
      .split(/\r?\n/)
      .map((l: string) => l.replace(/^\s*#+\s*/, "").replace(/^\s*\d+[.)]\s+/, ""))
      .join("\n")
      .trim();
    if (text) doc.sections[n - 1].body.push("", text);
  }
  return fromSections(doc);
}

function numberedLesson(lesson: string): string {
  const { preamble, sections } = toSections(lesson);
  const pre = preamble.join("\n").trim();
  return [pre, ...sections.map((s, i) => `[${i + 1}] ${s.heading}\n\n${s.body.join("\n").trim()}`)].filter(Boolean).join("\n\n");
}

/**
 * One day, end to end: the main lesson, expanded in place if it comes back
 * under the length floor, then the flashcards, chat starters and closing
 * axiom, drawn from that finished lesson.
 *
 * A lesson still under the floor after expansion is rejected, not delivered.
 * A day's lesson is written once and kept, so a short one would be short for
 * good; failing lets the reader's retry produce a complete one instead.
 */
export async function generateDayContent(ctx: CourseContext, day: DayPlan): Promise<DayContent> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const { system, user } = buildDayMessages(ctx, day);
  const written = await generateText(AI_TASKS.lesson, user, system, {
    maxOutputTokens: 32768,
    budgetMs: LESSON_BUDGET_MS,
    attempts: 2,
    validate: (lesson: string) => lessonStructureProblem(lesson),
  });
  let lesson = stripEmDashes(written.data);
  let wordCount = instructionalWordCount(lesson);
  let expansion: string | undefined;

  for (let round = 0; wordCount < MIN_LESSON_WORDS && round < MAX_EXPANSION_ROUNDS; round++) {
    const remaining = Math.min(EXPANSION_ROUND_MS, deadline - Date.now() - STUDY_AIDS_BUDGET_MS);
    if (remaining < MIN_EXPANSION_ROUND_MS) break;
    // Models add less than they are asked for, so ask for a clear margin.
    const wordsNeeded = Math.max(400, MIN_LESSON_WORDS - wordCount + 400);
    const msgs = buildExpansionMessages(ctx, day, numberedLesson(lesson), wordCount, wordsNeeded);
    try {
      const added = await generateJson(AI_TASKS.lessonExpand, msgs.user, msgs.system, {
        maxOutputTokens: 16384,
        budgetMs: remaining,
        attempts: 2,
        validate: (p) =>
          Array.isArray(p?.additions) && p.additions.some((a: any) => typeof a?.text === "string" && a.text.trim())
            ? null
            : "Expansion returned no additions.",
      });
      const merged = stripEmDashes(mergeAdditions(lesson, added.data.additions));
      // Merging must never break what made the lesson valid in the first place.
      if (lessonStructureProblem(merged)) break;
      lesson = merged;
      wordCount = instructionalWordCount(lesson);
      expansion = label(added);
      console.info(`[ai] day ${day.dayNumber}: expanded to ${wordCount} words via ${expansion}`);
    } catch (err: any) {
      console.warn(`[ai] day ${day.dayNumber}: expansion failed:`, err?.message);
      break;
    }
  }

  if (wordCount < MIN_LESSON_WORDS) {
    console.error(`[ai] day ${day.dayNumber}: lesson short after expansion (${wordCount}/${MIN_LESSON_WORDS} words, lesson via ${label(written)}).`);
    throw new Error("This lesson came back incomplete. Please try again.");
  }

  const aids = buildFlashcardsMessages(ctx.title, ctx.author, ctx.readingLevel, ctx.language, day.dayNumber, day.title, lesson);
  const studyAids = await generateJson(AI_TASKS.studyAids, aids.user, aids.system, {
    maxOutputTokens: 8192,
    // Expansion always leaves STUDY_AIDS_BUDGET_MS of the total for this.
    budgetMs: Math.max(MIN_EXPANSION_ROUND_MS, deadline - Date.now()),
    attempts: 3,
    validate: (p) => (validStudyAids(p) ? null : "Study aids came back incomplete."),
  });
  const p = studyAids.data;

  const generatedBy = { lesson: label(written), ...(expansion ? { expansion } : {}), studyAids: label(studyAids) };
  const content: DayContent = {
    lesson,
    flashcards: p.flashcards.slice(0, 3).map((c: any) => ({ front: stripEmDashes(c.front), back: stripEmDashes(c.back) })),
    chatSeed: p.chatSeed.slice(0, 3).map((s: string) => stripEmDashes(s)),
    closingAxiom: stripEmDashes(p.closingAxiom).trim(),
    wordCount,
    generatedBy,
  };
  if (!validLesson(content)) throw new Error("This lesson came back incomplete. Please try again.");
  console.info(`[ai] day ${day.dayNumber}: ${wordCount} words.`, generatedBy);
  return content;
}
