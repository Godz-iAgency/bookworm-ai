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
      .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
      // Everywhere else a comma preserves the clause boundary without inventing
      // a sentence break the author didn't write.
      .replace(/\s*[—–]\s*/g, ", ")
      // "a, — b" would otherwise leave a doubled separator behind.
      .replace(/,\s*,/g, ",")
  );
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

  for (const raw of stripEmDashes(lesson).split(/\r?\n/)) {
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
