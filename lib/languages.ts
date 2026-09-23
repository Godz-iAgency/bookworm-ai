/**
 * Output language for generated content, independent of reading level.
 *
 * Deliberately separate from lib/reading-levels.ts: level controls difficulty,
 * language controls which language that difficulty is expressed in. A course
 * can be Explorer-in-Spanish, which means simple Spanish as a Spanish reader
 * would judge it, not English Explorer prose carried across.
 *
 * Stored on the user profile as the default for new courses, and copied onto
 * each course at generation time. Day generation reads the course's own copy,
 * so changing the profile setting never rewrites a book already underway.
 */
export type LanguageId = "en" | "es" | "fr";

export interface Language {
  id: LanguageId;
  /** English name, for the settings row. */
  label: string;
  /** Endonym, so a Spanish or French reader recognises their own language. */
  native: string;
  /** How the language is named to the model. */
  promptName: string;
}

export const DEFAULT_LANGUAGE: LanguageId = "en";

export const LANGUAGES: Language[] = [
  { id: "en", label: "English", native: "English", promptName: "English" },
  { id: "es", label: "Spanish", native: "Español", promptName: "Spanish (Español)" },
  { id: "fr", label: "French", native: "Français", promptName: "French (Français)" },
];

/** Never throws: an unknown or missing id falls back to English. */
export function languageFromId(id: string | null | undefined): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
