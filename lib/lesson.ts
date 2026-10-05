/**
 * Parsing and clean-up for generated lesson text, shared by the lesson reader
 * and the generation API routes.
 */

export type LessonBlock = { type: "heading" | "para" | "item"; text: string };

/**
 * Replace em/en dashes with ordinary punctuation.
 *
 * The prompts ask the model not to use them, but models reach for em dashes
 * constantly and no instruction stops it reliably. Running this at render time
 * as well as at generation time means lessons already sitting in Firestore get
 * cleaned up too, without regenerating anything.
 */
export function stripEmDashes(text: string): string {
  return (
    text
      // Numeric ranges ("10–15 minutes") mean "to", not a clause break, so they
      // become a plain hyphen rather than a comma.
      .replace(/(\d)\s*[\u2014\u2013]\s*(\d)/g, "$1-$2")
      // Everywhere else a comma preserves the clause boundary without inventing
      // a sentence break the author didn't write.
      .replace(/\s*[\u2014\u2013]\s*/g, ", ")
      // "a, - b" would otherwise leave a doubled separator behind.
      .replace(/,\s*,/g, ",")
  );
}

/**
 * French or Spanish written without its accents or apostrophes ("s accumulent",
 * "Aujourd hui", "resultats"). A model sometimes produces this; the words are
 * all there, so it passes every other check, but a native reader sees broken
 * spelling on every line.
 *
 * Judged on the whole text and deliberately loose, so ordinary lessons never
 * trip it: real French elides constantly (l', d', qu', n', s') and carries an
 * accent on roughly one letter in thirty; real Spanish on about one in fifty.
 * A short text says too little to judge and always passes.
 */
export function spellingProblem(text: string, language: string): string | null {
  if (language !== "fr" && language !== "es") return null;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters < 2000) return null;
  const accented = (text.normalize("NFC").match(/[à-öø-ÿÀ-ÖØ-ß]/g) ?? []).length;
  if (language === "fr") {
    const apostrophes = (text.match(/\p{L}['’]\p{L}/gu) ?? []).length;
    if (apostrophes === 0 || accented / letters < 0.01) return "French came back without its accents or apostrophes.";
  } else if (accented / letters < 0.006) {
    return "Spanish came back without its accents.";
  }
  return null;
}

/**
 * Words that mix the Latin alphabet with another one, like "well-ведении":
 * a model glitch where one word slips into a different alphabet halfway
 * through. A real word never does that, so any hit is corruption. A word
 * written entirely in another alphabet is left alone, since a lesson can
 * legitimately quote one (a Japanese term in a book about ikigai).
 */
export function scriptGlitches(value: string): string[] {
  const found = new Set<string>();
  for (const raw of value.split(/\s+/)) {
    const word = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
    let latin = false;
    let other = false;
    for (const ch of word) {
      if (!/\p{L}/u.test(ch)) continue;
      if (/\p{Script=Latin}/u.test(ch)) latin = true;
      else other = true;
    }
    if (latin && other) found.add(word);
  }
  return [...found];
}

/**
 * Last resort for a word that slipped into another alphabet: keep only its
 * Latin letters ("well-ведении" becomes "well"). A slightly short word reads
 * far better than gibberish in another alphabet.
 */
export function stripScriptGlitches(value: string): string {
  let out = value;
  for (const word of scriptGlitches(value)) {
    out = out.split(word).join(word.replace(/[^\P{L}\p{Script=Latin}]/gu, "").replace(/^[-‐]+|[-‐]+$/g, ""));
  }
  return out;
}

/**
 * Parse a lesson into blocks. New lessons use "## " section headings and
 * "1./2./3." takeaway lines; older plain-text lessons (generated before this)
 * simply have no headings and still render as clean, spaced paragraphs.
 */
export function parseLesson(lesson: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: "para", text: para.join(" ") });
      para = [];
    }
  };

  // Both cleanups also run at generation time; running them here too fixes
  // lessons already stored before they existed.
  for (const raw of stripScriptGlitches(stripEmDashes(lesson)).split(/\r?\n/)) {
    const line = raw.trim().replace(/\*\*/g, ""); // strip stray markdown bold
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("##")) {
      flush();
      blocks.push({ type: "heading", text: line.replace(/^#+\s*/, "").trim() });
      continue;
    }
    if (/^\d+[.)]\s/.test(line)) {
      flush();
      blocks.push({ type: "item", text: line });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/**
 * A lesson's prose, with its closing actions lifted out of it, along with the
 * heading written right above them. That heading belongs with the actions:
 * left in the prose it ends up alone at the foot of a page, with the actions
 * it introduces on the next one.
 */
export type LessonSplit = { blocks: LessonBlock[]; actions: string[]; actionsHeading?: string };

/**
 * Models sometimes turn "the 24-hour actions" into a heading like "24 Actions
 * for Day Five". A bare leading number reads as a count of actions, so it is
 * dropped, unless it is part of a time ("24 Hours to Act", "24 horas").
 */
export function cleanActionsHeading(heading: string): string {
  return heading.replace(/^\s*\d+\s+(?!(?:hours?|hrs?|horas?|heures?)\b)/i, "").trim() || heading;
}

/**
 * Separate the day's closing actions from the lesson that argues for them.
 *
 * The lesson prompt asks for a final section of exactly three numbered lines,
 * and parseLesson already classifies those as `item` blocks - so the actions
 * are the trailing run of items. Only the trailing run: a numbered aside in the
 * middle of a lesson is prose the reader is meant to read, not a commitment
 * they are meant to make.
 *
 * A single trailing item is left as prose, because one item is a stray rather
 * than a list to choose between. Lessons written before this format have no
 * trailing items at all and come back untouched, which is what lets the
 * checklist work on courses generated long before it existed.
 */
export function splitLesson(lesson: string): LessonSplit {
  const blocks = parseLesson(lesson);

  let start = blocks.length;
  while (start > 0 && blocks[start - 1].type === "item") start--;
  const count = blocks.length - start;
  if (count < 2 || count > 6) return { blocks, actions: [] };

  const headed = start > 0 && blocks[start - 1].type === "heading";
  return {
    blocks: blocks.slice(0, headed ? start - 1 : start),
    // The "1./2./3." stays: each action is numbered AND has a checkbox, not
    // one or the other.
    actions: blocks.slice(start).map((b) => b.text),
    ...(headed ? { actionsHeading: cleanActionsHeading(blocks[start - 1].text) } : {}),
  };
}
