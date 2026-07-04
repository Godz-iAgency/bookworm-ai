/**
 * The genre options the reader picks during onboarding and can edit later in
 * Profile. Saved to the user's Firestore doc as `genrePreferences` (an array of
 * these strings) and used to personalize book recommendations on /search.
 */
export const GENRES = [
  "Fiction",
  "Non-Fiction",
  "Mystery",
  "Science Fiction",
  "Fantasy",
  "Romance",
  "Thriller",
  "Biography",
  "History",
  "Self-Help",
  "Business",
  "Philosophy",
] as const;

/** How many genres the reader picks. */
export const GENRE_PICK_COUNT = 3;

/** Toggle a genre in a selection, capping at `max`. */
export function toggleGenre(prev: string[], genre: string, max = GENRE_PICK_COUNT): string[] {
  if (prev.includes(genre)) return prev.filter((g) => g !== genre);
  if (prev.length < max) return [...prev, genre];
  return prev;
}
