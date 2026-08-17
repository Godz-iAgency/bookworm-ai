/**
 * Prompt building for Personal Development summaries.
 *
 * Different goal from course-prompts.ts. A course teaches the reader a topic
 * across 7 days; a mastery summary is a faithful long-form account of one
 * specific book: its real argument, in its real order, using its real
 * vocabulary, so that finishing it leaves you knowing what THAT book says
 * rather than what books in its genre generally say.
 *
 * Fidelity is pushed hard, and the lever is specificity, not reproduction.
 * The model is required to name the book's actual frameworks, actual case
 * studies, and actual chapter progression, and is required to admit when it
 * does not reliably know them. It is not asked to reproduce the book's prose,
 * and is explicitly told not to: quoting at length would be copyright
 * infringement, and it also produces worse summaries, because stitched
 * fragments read as disconnected where synthesis reads as understanding.
 */

import { STYLE_RULES } from "./course-prompts";

/**
 * The accuracy contract, attached to every call. The failure mode this exists
 * to prevent is confident genre-mush: a "summary" of a book the model half
 * remembers, padded with plausible-sounding advice that book never gave.
 */
const FIDELITY_RULES = `ACCURACY REQUIREMENTS (these matter more than fluency):

- Summarise THIS book, not its genre. Every substantive claim should be one this specific author actually makes. If a point is generic advice that could appear in any book on the subject, cut it.
- Use the author's own vocabulary for their own ideas. If they named a framework, a law, a step, a stage, a matrix, or a rule, call it by that name and define it the way they define it. Their terminology is the scaffolding of the summary.
- Follow the book's real structure. Cover its parts in the order the author put them in, and preserve the logic of why one idea has to come before the next.
- Ground ideas in the book's own material. Reference the specific studies, case studies, companies, historical episodes, clients, or personal stories the author actually uses. Name them.
- Preserve the author's actual positions, including the unpopular or counterintuitive ones, and including anything that contradicts conventional wisdom in the field. Do not sand the book down into something safer or more agreeable than it is.

HONESTY REQUIREMENT: If you do not reliably know this book's specific content, do not invent it. Set "confident" to false and summarise only what you genuinely know, saying plainly where your knowledge of the book runs out. A short accurate summary is worth more than a long invented one. Never fabricate a framework name, a study, or a statistic.

ORIGINAL PROSE: Write every sentence yourself, in your own words. Do not reproduce passages from the book. Short quoted phrases (a sentence at most, in quotation marks) are fine where the exact wording is the point, such as a coined term or a famous line. The value here is a faithful account of the author's thinking, not a copy of their pages.`;

/**
 * Register for the summary. Deliberately not the course PERSONAS: those set a
 * reading level, and this feature has no level picker. This asks for the
 * author's own register instead, which is itself a fidelity lever.
 */
const VOICE_RULES = `VOICE: Write in the register of the book itself. A blunt, profane, high-intensity book should read blunt and high-intensity; an academic one should read rigorous and measured; a story-driven one should keep its narrative pull. Match the author's energy, not a neutral textbook tone. You are writing for one serious reader who wants to actually absorb this book, so be direct, concrete, and free of filler. No throat-clearing, no "in today's fast-paced world", no restating the obvious.`;

/**
 * Call 1: the map. Cheap and fast, and everything downstream depends on it,
 * so it is asked for structure only, no prose.
 */
export function buildSummaryOutlineMessages(title: string, author: string) {
  const system = `You are a rigorous book analyst. You produce faithful, structurally accurate accounts of specific non-fiction books. You ALWAYS return valid JSON matching the requested schema exactly, with no commentary and no markdown fences.

${FIDELITY_RULES}

${STYLE_RULES}`;

  const user = `Book: "${title}" by ${author || "Unknown Author"}

Plan a long-form summary of this book, faithful to how the author actually built it.

First, identify:
- "thesis": the book's central argument in 2 to 3 sentences, in the author's own terms.
- "frameworks": the named models, laws, steps, stages, or rules this book is known for. Use the author's exact names. Empty array if the book genuinely has none.
- "confident": true only if you reliably know this specific book's actual content. False if you are working from general knowledge of the author or the topic.

Then break the book into exactly 5 sections that follow its real progression from front to back. These are not invented themes: they should map onto the book's actual parts, chapters, or movements, grouped so each section covers a substantial piece of ground. For each section give:
- "title": 2 to 6 words, using the author's language where the book has a name for this part.
- "focus": one sentence on what this section of the book establishes.
- "keyIdeas": 3 to 5 short strings naming the specific concepts, frameworks, studies, or stories the author uses HERE. These drive the writing later, so be concrete and specific to this book.

Return ONLY this JSON:
{
  "confident": true,
  "thesis": "...",
  "frameworks": ["...", "..."],
  "sections": [
    { "title": "...", "focus": "...", "keyIdeas": ["...", "...", "..."] }
  ]
}

"sections" must contain exactly 5 items.`;

  return { system, user };
}

/**
 * Call 2..N: one section's prose. Run sequentially, one section at a time -
 * see useSummaryGeneration.ts for why. The full outline is passed every time
 * so sections stay in their lane and pick up where the previous one left off
 * instead of each restating the basics.
 */
export function buildSummarySectionMessages(
  title: string,
  author: string,
  thesis: string,
  allTitles: string[],
  index: number,
  sectionTitle: string,
  focus: string,
  keyIdeas: string[]
) {
  const system = `You are a rigorous book analyst writing one section of a long-form summary of a specific book. You ALWAYS return valid JSON matching the requested schema exactly, with no commentary and no markdown fences.

${FIDELITY_RULES}

${VOICE_RULES}

${STYLE_RULES}

SECTION FORMATTING RULES:
- Write 1100 to 1400 words of flowing prose. Do not write short. This section is one fifth of a 15 to 20 page summary, so it needs to actually cover its ground, not sketch it.
- Break the section into 3 to 5 subsections. Each begins with its own heading on its own line, written as "## " (exactly two hash marks and one space) followed by a 2 to 5 word title, then a blank line, then that subsection's paragraphs.
- Use "## " ONLY for headings. No other markdown, no asterisks, no bullet symbols.
- Where the author gives a numbered sequence, you may lay it out as lines beginning "1.", "2.", "3." and so on.
- Separate every heading and paragraph with a single blank line.
- Explain ideas properly rather than listing them. A named framework should be defined, shown working through the author's own example, and given its limits if the author gives them.`;

  const arc = allTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const user = `Book: "${title}" by ${author || "Unknown Author"}

The book's central argument:
${thesis}

The full summary is structured as:
${arc}

Write ONLY section ${index + 1}: "${sectionTitle}".

What this section covers: ${focus}

Build it around this book's actual material:
${keyIdeas.map((k) => `- ${k}`).join("\n")}

Stay inside this section's scope. Assume the reader has read the sections before it, so do not re-explain them, and do not pre-empt the ones after it. ${index === 0 ? "As the opening section, establish why the book's central problem matters before getting into the machinery." : ""}${index === allTitles.length - 1 ? "As the closing section, land the book's argument and make clear what the author wants the reader to actually do." : ""}

Return ONLY this JSON:
{
  "prose": "700-900 words following the formatting rules"
}`;

  return { system, user };
}
