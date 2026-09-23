/**
 * The part of a lesson Book Pal needs to answer one question.
 *
 * Sending the whole lesson with every chat message made chat
 * about a third of a course's AI cost, for replies capped at 25 words. This
 * keeps the lesson's map (its section headings), the sections that share the
 * question's words, and the 24-hour actions, which readers ask about most.
 * Matching is on word stems, not English grammar, so it works the same for
 * Spanish and French lessons. No extra model call is involved.
 */

const STOP = new Set(
  "what when where which while with would could should about after again also because before being between both does doing down during each from have having here into just like more most much only other over same some such than that their them then there these they this those through under until very were what your yours about como para pero porque este esta esto estos estas sobre cuando donde tiene quel quelle pour dans avec sont cette comme mais leur plus".split(" ")
);

const stem = (w: string) => w.slice(0, 6);
const terms = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4 && !STOP.has(w))
    .map(stem);
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

interface Section {
  heading: string;
  body: string;
}

function sections(lesson: string): Section[] {
  const out: Section[] = [];
  let current: Section = { heading: "", body: "" };
  for (const line of lesson.split(/\r?\n/)) {
    if (/^\s*##\s/.test(line)) {
      if (current.heading || current.body.trim()) out.push(current);
      current = { heading: line.replace(/^\s*#+\s*/, "").trim(), body: "" };
    } else {
      current.body += line + "\n";
    }
  }
  if (current.heading || current.body.trim()) out.push(current);
  return out.map((s) => ({ heading: s.heading, body: s.body.trim() }));
}

export function lessonExcerpt(lesson: string, question: string, maxWords = 900): string {
  const all = sections(lesson);
  if (all.length < 2) {
    return lesson.split(/\s+/).slice(0, maxWords).join(" ");
  }
  const actions = all[all.length - 1];
  const teaching = all.slice(0, -1);

  const wanted = new Set(terms(question));
  const scored = teaching.map((s, i) => {
    const words = terms(s.body);
    const headingWords = new Set(terms(s.heading));
    let score = 0;
    for (const w of words) if (wanted.has(w)) score++;
    for (const w of headingWords) if (wanted.has(w)) score += 3;
    return { i, score };
  });

  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.i);
  // A general question ("what is this about?") matches nothing specific: give
  // it the opening concept and the closing takeaway.
  const order = matched.length ? matched : [0, teaching.length - 1];

  const chosen = new Map<number, string>();
  let budget = maxWords;
  for (const i of order) {
    if (budget <= 0 || chosen.has(i)) continue;
    const body = teaching[i].body.split(/\s+/).slice(0, budget).join(" ");
    chosen.set(i, body);
    budget -= wordCount(body);
  }

  const parts = [`Sections of this lesson: ${teaching.map((s) => s.heading).filter(Boolean).join(" | ")}`];
  for (const i of [...chosen.keys()].sort((a, b) => a - b)) {
    parts.push(`## ${teaching[i].heading}\n${chosen.get(i)}`);
  }
  parts.push(`## ${actions.heading}\n${actions.body}`);
  return parts.join("\n\n");
}
