import { MASTERY_PILLARS } from "@/lib/mastery-library";

/**
 * The topics a reader picks from at onboarding and can edit later in Profile.
 * Saved to the user's Firestore doc as `genrePreferences` (an array of these
 * strings) and used to pick the recommendations on their shelf.
 *
 * Derived from the Personal Development pillars rather than listed separately,
 * because a pick is only useful if it resolves to a shelf of real books. The
 * old list was generic bookshop genres (Fiction, Mystery, Fantasy...), none of
 * which this library carries — so a reader could complete onboarding having
 * told us nothing we could act on. Readers can still start any book at all
 * through search; this is only what we recommend from.
 */
export const GENRES: string[] = MASTERY_PILLARS.map((p) => p.name);

/** How many topics the reader picks. */
export const GENRE_PICK_COUNT = 3;

/**
 * Keep only the topics still on offer.
 *
 * Saved preferences outlive the list they were picked from. Everyone who
 * onboarded before the topics became these pillars has bookshop genres saved
 * instead ("Self-Help", "Non-Fiction"), and renaming a pillar later would
 * strand its name the same way. A saved name with no tile can't show as
 * selected — but it still counted toward the three-pick cap, which locked the
 * whole grid behind selections the reader could neither see nor clear.
 *
 * Filtering on the way in means the picker only ever holds picks it can draw,
 * so what a reader sees selected, the count, and the cap always agree.
 */
export function knownGenres(saved: string[]): string[] {
  return saved.filter((g) => GENRES.includes(g));
}

/** Toggle a topic in a selection, capping at `max`. */
export function toggleGenre(prev: string[], genre: string, max = GENRE_PICK_COUNT): string[] {
  if (prev.includes(genre)) return prev.filter((g) => g !== genre);
  if (prev.length < max) return [...prev, genre];
  return prev;
}
