/**
 * Shared prompt building for course generation.
 *
 * Architecture: the course is generated in small, reliable pieces rather than
 * one giant call. `buildOutlineMessages` returns the 7-day arc (titles +
 * previews + key ideas) plus Day 1's full content. `buildDayMessages` generates
 * one later day's full lesson on demand when the reader opens it.
 *
 * Two different jobs are being done here and they must not be confused:
 * FIDELITY_RULES govern WHAT is taught (this book's real content), and the
 * PERSONAS govern HOW it is delivered (the reader's chosen level). A course can
 * be written for a ten-year-old and still be about the author's actual
 * framework rather than the genre's generic advice.
 */

/**
 * Punctuation rule applied to every generated surface (lessons, flashcards,
 * chat). Models reach for em dashes constantly, so this is also enforced after
 * the fact by stripEmDashes() in lib/lesson.ts — the instruction reduces how
 * often the sanitizer has to do anything, it doesn't replace it.
 */
export const STYLE_RULES = `PUNCTUATION RULE: Never use an em dash (—) or an en dash (–) anywhere in your output. Where you would reach for one, use a comma, a period, a colon, or parentheses instead. Use a plain hyphen only inside hyphenated words and number ranges.`;

/**
 * The accuracy contract, attached to every call.
 *
 * Ported from the Personal Development summary prompts, which produced
 * measurably more faithful output than this file's original instructions did.
 * The failure mode it exists to prevent is confident genre-mush: a "course" on
 * a book the model half remembers, padded with plausible advice that book never
 * gave. The lever is specificity, not length. Naming the author's actual
 * frameworks and actual examples is what forces recall of the real book instead
 * of a summary of its category.
 */
export const FIDELITY_RULES = `ACCURACY REQUIREMENTS (these matter more than fluency):

- Teach THIS book, not its genre. Every substantive claim should be one this specific author actually makes. If a point is generic advice that could appear in any book on the subject, cut it and replace it with something only this book says.
- Use the author's own vocabulary for their own ideas. If they named a framework, a law, a step, a stage, a matrix, or a rule, call it by that name and define it the way they define it. Their terminology is the scaffolding of the course.
- Ground ideas in the book's own material. Reference the specific studies, case studies, companies, historical episodes, clients, or personal stories the author actually uses. Name them.
- Preserve the author's actual positions, including the unpopular or counterintuitive ones, and including anything that contradicts conventional wisdom in the field. Do not sand the book down into something safer or more agreeable than it is.

HONESTY REQUIREMENT: If you do not reliably know this book's specific content, do not invent it. Set "familiar" to false and build the strongest course you can on the book's apparent topic, saying nothing you cannot stand behind. Never fabricate a framework name, a study, or a statistic.

ORIGINAL PROSE: Write every sentence yourself, in your own words. Do not reproduce passages from the book. Short quoted phrases (a sentence at most, in quotation marks) are fine where the exact wording is the point, such as a coined term or a famous line.`;

/** Voice persona per reading level — applied to ALL generated text. */
export const PERSONAS: Record<string, string> = {
  explorer: `EXPLORER VOICE: Write at a 3rd-to-5th grade reading level (Flesch-Kincaid grade 3–5). Use short sentences. Use simple, common words. Explain every idea with an everyday analogy a 10-year-old would understand (piggy banks, playgrounds, recipes, video games, sports). No jargon. Be warm, fun, and encouraging. This controls HOW you write, never WHAT you teach: still use the author's real framework names, and still explain their real examples, just in language this reader can follow.`,
  scholar: `SCHOLAR VOICE: Write in the authentic voice and tone of the original author — match their vocabulary, cadence, and storytelling style as closely as you can. If you are not confident about this author's style, write as a warm, knowledgeable professor: clear and substantive, never dumbed down.`,
  architect: `ARCHITECT VOICE: Write in the style of Alex Hormozi — direct, blunt, zero fluff, high energy. Short punchy sentences. Lead with the point. Every concept must end with a specific action the reader can take TODAY. No filler, no hedging. This controls HOW you write, never WHAT you teach: the ideas are still this author's, called by this author's names.`,
};

const LESSON_RULES = `LESSON FORMATTING RULES:
- Organize the lesson into 4–6 short sections. Each section BEGINS with its own heading on its own line, written as "## " (exactly two hash marks and one space) followed by a 2–5 word title. Example: "## Why This Matters". Then a blank line, then that section's paragraph(s).
- Use "## " ONLY for section headings. Do NOT use any other markdown, asterisks, bold markers, or bullet symbols anywhere in the body.
- Section flow: (1) an opening section that hooks why this matters to the reader's life, (2) two to four sections that teach the core idea, (3) a final section whose heading signals action, containing exactly three takeaways written as three lines starting with "1.", "2.", "3." — each a concrete action.
- Explain ideas properly rather than listing them. A named framework should be defined, shown working through the author's own example, and given its limits if the author gives them.
- Separate every heading and paragraph with a single blank line.
- The lesson MUST be 800–1200 words (headings not counted). Aim for 1000+. Do not write short.`;

const FLASHCARD_RULES = `FLASHCARD RULES: exactly 3. Front = an open-ended question (what / how / why), 5–10 words, never yes/no. Back = a concise answer, 10–15 words. Draw them from this book's specific ideas, using the author's own terms where they have them.`;

export function getPersona(readingLevel: string): string {
  return PERSONAS[readingLevel] ?? PERSONAS.scholar;
}

/**
 * First call: the 7-day arc (titles + previews + key ideas) + Day 1 full
 * content.
 *
 * The arc is planned in one shot, before any lesson is written, for the same
 * reason the summary outline is: every later day is generated against it, so
 * the days build on each other instead of each restating the book's premise.
 * The key ideas are the important part. They are the concrete anchors that get
 * handed back to buildDayMessages days later, and they are what keep day five
 * about the book's fifth movement rather than about the topic in general.
 */
export function buildOutlineMessages(title: string, author: string, readingLevel: string) {
  const system = `You are the course architect for Bookworm.AI. You turn specific books into structured 7-day learning courses that are faithful to what those books actually say. You ALWAYS return valid JSON matching the requested schema exactly — no commentary, no markdown fences.

${FIDELITY_RULES}

${getPersona(readingLevel)}

${STYLE_RULES}

${LESSON_RULES}

${FLASHCARD_RULES}`;

  const user = `Book: "${title}" by ${author || "Unknown Author"}

First, identify:
- "thesis": the book's central argument in 2 to 3 sentences, in the author's own terms.
- "frameworks": the named models, laws, steps, stages, or rules this book is known for. Use the author's exact names. Empty array if the book genuinely has none.
- "familiar": true only if you reliably know this specific book's actual content. False if you are working from general knowledge of the author or the topic.

Then compress the WHOLE book into exactly 7 days.

This is the most important instruction here: the seven days together must cover the book front to back, not just its opening premise. Map the days onto the book's own real progression — its actual parts, chapters, or movements — grouped so that each day carries a substantial piece of the argument. A reader who finishes day 7 should have met every major idea in the book. Do not spend four days circling the introduction, and do not invent a generic arc that ignores how this author actually built their case.

Order the days so each one depends on the one before it, the way the book does.

For each of the 7 days give:
- "title": 3 to 6 words, using the author's language where the book has a name for this part.
- "previewText": one sentence, 15 to 20 words, on what this day covers.
- "keyIdeas": 3 to 5 short strings naming the specific concepts, frameworks, studies, stories, or examples the author uses HERE. These are what the lesson gets written from later, so be concrete and specific to this book. Never generic.

Then write the full "lesson", "flashcards", and "chatSeed" for DAY 1 ONLY. Do NOT write lessons for days 2 to 7.
Day 1's lesson must begin its hook with a one-sentence roadmap naming what the 7 days cover.

Return ONLY this JSON:
{
  "familiar": true,
  "thesis": "...",
  "frameworks": ["...", "..."],
  "days": [
    { "dayNumber": 1, "title": "...", "previewText": "...", "keyIdeas": ["...", "...", "..."], "lesson": "800–1200 words", "flashcards": [{ "front": "...", "back": "..." }], "chatSeed": ["...", "...", "..."] },
    { "dayNumber": 2, "title": "...", "previewText": "...", "keyIdeas": ["...", "...", "..."] }
  ]
}

The "days" array must contain exactly 7 items (dayNumber 1–7). Day 1's "flashcards" and "chatSeed" must each contain exactly 3 items.`;

  return { system, user };
}

/**
 * Repair path: rebuild only the flashcards + chat starters for a day whose
 * lesson we already have. The outline call occasionally returns Day 1 with a
 * good lesson but an empty `flashcards` array, and Day 1 never re-fetches
 * (its lesson already exists), so the deck would otherwise stay empty
 * forever. Deriving from the stored lesson keeps the cards true to what the
 * reader actually read — and never rewrites that lesson.
 */
export function buildFlashcardsMessages(
  title: string,
  author: string,
  readingLevel: string,
  dayNumber: number,
  dayTitle: string,
  lesson: string
) {
  const system = `You are the course architect for Bookworm.AI. You write study aids for one day of a 7-day course. You ALWAYS return valid JSON matching the requested schema exactly — no commentary, no markdown fences.

${getPersona(readingLevel)}

${STYLE_RULES}

${FLASHCARD_RULES}`;

  const user = `Book: "${title}" by ${author || "Unknown Author"}
Day ${dayNumber}: "${dayTitle}"

This is the lesson the reader has already been given for this day:
"""
${lesson}
"""

Write exactly 3 flashcards drawn from the ideas in THAT lesson — do not introduce concepts it does not cover. Then write exactly 3 conversational starter questions a reader might ask about it.

Return ONLY this JSON:
{
  "flashcards": [{ "front": "...", "back": "..." }],
  "chatSeed": ["...", "...", "..."]
}

"flashcards" and "chatSeed" must each contain exactly 3 items.`;

  return { system, user };
}

/**
 * On-demand: one later day's full lesson + flashcards + chatSeed.
 *
 * Everything the outline learned about the book is passed back in — the thesis,
 * the named frameworks, the full arc, and this day's own key ideas — so a day
 * written five days later is still writing about the same book the outline
 * planned, and picks up where the previous day left off instead of starting
 * over from the premise.
 */
export function buildDayMessages(
  title: string,
  author: string,
  readingLevel: string,
  dayNumber: number,
  dayTitle: string,
  allTitles: string[],
  thesis = "",
  frameworks: string[] = [],
  keyIdeas: string[] = []
) {
  const system = `You are the course architect for Bookworm.AI. You write one day's lesson for a 7-day course on a specific book. You ALWAYS return valid JSON matching the requested schema exactly — no commentary, no markdown fences.

${FIDELITY_RULES}

${getPersona(readingLevel)}

${STYLE_RULES}

${LESSON_RULES}

${FLASHCARD_RULES}`;

  const arc = allTitles.map((t, i) => `Day ${i + 1}: ${t}`).join("\n");

  const user = `Book: "${title}" by ${author || "Unknown Author"}
${thesis ? `\nThe book's central argument:\n${thesis}\n` : ""}${
    frameworks.length > 0 ? `\nThe book's named frameworks: ${frameworks.join(", ")}\n` : ""
  }
The full 7-day arc is:
${arc}

Write ONLY Day ${dayNumber}: "${dayTitle}".
${
  keyIdeas.length > 0
    ? `\nBuild it around this book's actual material for this day:\n${keyIdeas
        .map((k) => `- ${k}`)
        .join("\n")}\n`
    : ""
}
Stay inside this day's scope. Assume the reader has read the days before it, so do not re-explain them, and do not pre-empt the ones after it.${
    dayNumber === 7
      ? " As the closing day, land the book's argument and make clear what the author wants the reader to actually do."
      : ""
  }

Return ONLY this JSON:
{
  "lesson": "800–1200 words following the formatting rules",
  "flashcards": [{ "front": "...", "back": "..." }],
  "chatSeed": ["...", "...", "..."]
}

"flashcards" and "chatSeed" must each contain exactly 3 items.`;

  return { system, user };
}
