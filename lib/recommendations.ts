import { MASTERY_PILLARS, type MasteryBook } from "@/lib/mastery-library";

export interface Recommendation {
  pillarSlug: string;
  pillarName: string;
  book: MasteryBook;
}

/**
 * Small seeded PRNG so a set of recommendations is stable for as long as the
 * reader is looking at it. Math.random() inside a render would reshuffle the
 * shelf on every unrelated re-render, which reads as a glitch.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Pick books to put in front of a reader, from the pillars they said they cared
 * about at onboarding.
 *
 * Deliberately never returns nothing. A reader with no preferences saved, or
 * with preferences from the old bookshop-genre list that no longer name a real
 * pillar, gets picks from the whole library instead of an empty shelf — the
 * point of this row is that there is always somewhere to go next.
 *
 * Every pick comes from a different pillar, so the row reads as three different
 * ideas rather than three variations on one. Pillars the reader actually asked
 * for are used first, and the rest only backfill when those run short.
 */
export function pickRecommendations({
  topics,
  excludeTitles = [],
  count = 3,
  seed = 0,
}: {
  topics: string[];
  excludeTitles?: string[];
  count?: number;
  seed?: number;
}): Recommendation[] {
  const rand = rng(seed);

  // Chosen pillars first, then the rest as backfill. Taking one book per pillar
  // below then means three different categories even when the reader's saved
  // topics name fewer than three real pillars — which is every reader who
  // onboarded on the old genre list, since only Business and Biography survive
  // it as names. Those readers were getting three books off one shelf.
  const isChosen = (p: (typeof MASTERY_PILLARS)[number]) => topics.includes(p.name);
  const pool = [
    ...shuffled(MASTERY_PILLARS.filter(isChosen), rand),
    ...shuffled(MASTERY_PILLARS.filter((p) => !isChosen(p)), rand),
  ];

  const taken = new Set(excludeTitles.map((t) => t.trim().toLowerCase()));

  const queues = pool.map((pillar) =>
    shuffled(
      pillar.books.filter((b) => !taken.has(b.title.trim().toLowerCase())),
      rand
    ).map((book) => ({ pillarSlug: pillar.slug, pillarName: pillar.name, book }))
  );

  const out: Recommendation[] = [];
  for (let round = 0; out.length < count; round++) {
    const before = out.length;
    for (const queue of queues) {
      const next = queue[round];
      if (next) out.push(next);
      if (out.length === count) return out;
    }
    // Every queue is exhausted — the reader has started nearly everything.
    if (out.length === before) break;
  }
  return out;
}
