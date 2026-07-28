/**
 * Shared prompt building for course generation (Phase 4).
 *
 * Architecture: the course is generated in small, reliable pieces rather than
 * one giant call. `buildOutlineMessages` returns the 7-day arc (titles +
 * previews) plus Day 1's full content. `buildDayMessages` generates one later
 * day's full lesson on demand when the reader opens it.
 */

/** Voice persona per reading level — applied to ALL generated text. */
export const PERSONAS: Record<string, string> = {
  explorer: `EXPLORER VOICE: Write at a 3rd-to-5th grade reading level (Flesch-Kincaid grade 3–5). Use short sentences. Use simple, common words. Explain every idea with an everyday analogy a 10-year-old would understand (piggy banks, playgrounds, recipes, video games, sports). No jargon. Be warm, fun, and encouraging.`,
  scholar: `SCHOLAR VOICE: Write in the authentic voice and tone of the original author — match their vocabulary, cadence, and storytelling style as closely as you can. If you are not confident about this author's style, write as a warm, knowledgeable professor: clear and substantive, never dumbed down.`,
  architect: `ARCHITECT VOICE: Write in the style of Alex Hormozi — direct, blunt, zero fluff, high energy. Short punchy sentences. Lead with the point. Every concept must end with a specific action the reader can take TODAY. No filler, no hedging.`,
};

const LESSON_RULES = `LESSON FORMATTING RULES:
- Organize the lesson into 4–6 short sections. Each section BEGINS with its own heading on its own line, written as "## " (exactly two hash marks and one space) followed by a 2–5 word title. Example: "## Why This Matters". Then a blank line, then that section's paragraph(s).
- Use "## " ONLY for section headings. Do NOT use any other markdown, asterisks, bold markers, or bullet symbols anywhere in the body.
- Section flow: (1) an opening section that hooks why this matters to the reader's life, (2) two to four sections that teach the core idea, (3) a final section whose heading signals action, containing exactly three takeaways written as three lines starting with "1.", "2.", "3." — each a concrete action.
- Separate every heading and paragraph with a single blank line.
- The lesson MUST be 800–1200 words (headings not counted). Aim for 1000+. Do not write short.`;

const FLASHCARD_RULES = `FLASHCARD RULES: exactly 3. Front = an open-ended question (what / how / why), 5–10 words, never yes/no. Back = a concise answer, 10–15 words.`;

export function getPersona(readingLevel: string): string {
  return PERSONAS[readingLevel] ?? PERSONAS.scholar;
}

/** First call: 7-day arc (titles + previews) + Day 1 full content only. */
export function buildOutlineMessages(title: string, author: string, readingLevel: string) {
  const system = `You are the course architect for Bookworm.AI. You turn books into structured 7-day learning courses. You ALWAYS return valid JSON matching the requested schema exactly — no commentary, no markdown fences.

${getPersona(readingLevel)}

${LESSON_RULES}

${FLASHCARD_RULES}`;

  const user = `Book: "${title}" by ${author || "Unknown Author"}

Break the book into 7 core concepts that progress as a learning arc:
- Day 1: the single foundational idea everything builds on.
- Days 2–3: the core principles and how they work.
- Days 4–5: deeper frameworks, mental models, and strategies.
- Day 6: common mistakes and counterintuitive truths.
- Day 7: synthesis — tie it all together and what to do next.

If you do not genuinely know this specific book, set "familiar" to false and build the best possible course on the book's apparent topic or genre instead.

Provide a "title" (3–6 words) and "previewText" (one sentence, 15–20 words) for ALL 7 days.
Provide the full "lesson", "flashcards", and "chatSeed" for DAY 1 ONLY. Do NOT write lessons for days 2–7.
Day 1's lesson must begin its hook with a one-sentence roadmap naming what the 7 days cover.

Return ONLY this JSON:
{
  "familiar": true,
  "days": [
    { "dayNumber": 1, "title": "...", "previewText": "...", "lesson": "800–1200 words", "flashcards": [{ "front": "...", "back": "..." }], "chatSeed": ["...", "...", "..."] },
    { "dayNumber": 2, "title": "...", "previewText": "..." }
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

/** On-demand: one later day's full lesson + flashcards + chatSeed. */
export function buildDayMessages(
  title: string,
  author: string,
  readingLevel: string,
  dayNumber: number,
  dayTitle: string,
  allTitles: string[]
) {
  const system = `You are the course architect for Bookworm.AI. You write one day's lesson for a 7-day course. You ALWAYS return valid JSON matching the requested schema exactly — no commentary, no markdown fences.

${getPersona(readingLevel)}

${LESSON_RULES}

${FLASHCARD_RULES}`;

  const arc = allTitles.map((t, i) => `Day ${i + 1}: ${t}`).join("\n");

  const user = `Book: "${title}" by ${author || "Unknown Author"}

The full 7-day arc is:
${arc}

Write ONLY Day ${dayNumber}: "${dayTitle}". Stay on this day's concept; do not repeat other days.

Return ONLY this JSON:
{
  "lesson": "800–1200 words following the formatting rules",
  "flashcards": [{ "front": "...", "back": "..." }],
  "chatSeed": ["...", "...", "..."]
}

"flashcards" and "chatSeed" must each contain exactly 3 items.`;

  return { system, user };
}
