"use client";

import { auth } from "./firebase/config";
import { getUserProfile } from "./firebase/profile";
import { DEFAULT_LANGUAGE, LANGUAGES } from "./languages";
import { READING_LEVELS } from "./reading-levels";
import type { Course, Day } from "./BookwormContext";

/** The language and reading level one day of a course is written in. */
export interface LessonSettings {
  readingLevel: string;
  language: string;
}

const isLevel = (v: unknown): v is string => typeof v === "string" && READING_LEVELS.some((l) => l.id === v);
const isLanguage = (v: unknown): v is string => typeof v === "string" && LANGUAGES.some((l) => l.id === v);

/**
 * What an already-written day was written in. Days carry their own settings
 * once a reader has switched mid-book; before that, the course's are theirs.
 */
export function settingsOfDay(course: Course, day: Day | undefined): LessonSettings {
  return {
    readingLevel: day?.readingLevel || course.readingLevel,
    language: day?.language || course.language || DEFAULT_LANGUAGE,
  };
}

/**
 * What the NEXT day of this course should be written in: the reader's current
 * Profile settings. Changing language or reading level on Profile therefore
 * reaches the days of a book that are not written yet; days already written
 * stay as they are. A Book Club member's view of someone else's book keeps
 * that book's own settings (they never generate it anyway). Falls back to the
 * course's settings if the profile cannot be read.
 */
export async function settingsForNextDay(course: Course): Promise<LessonSettings> {
  const fallback = { readingLevel: course.readingLevel, language: course.language || DEFAULT_LANGUAGE };
  const uid = auth.currentUser?.uid;
  if (!uid || course.sharedFrom) return fallback;
  try {
    const profile = await getUserProfile(uid);
    return {
      readingLevel: isLevel(profile?.readingLevel) ? profile!.readingLevel! : fallback.readingLevel,
      language: isLanguage(profile?.preferredLanguage) ? profile!.preferredLanguage! : fallback.language,
    };
  } catch {
    return fallback;
  }
}

/**
 * Records that `dayNumber` was written with `settings`.
 *
 * The first time a day differs from the course, every day already written is
 * stamped with the course's old settings (so repairs, axioms and chat for those
 * days stay in the language they were written in), and the course's own
 * settings move to the new ones, which is what the shelf and Book Pal show.
 */
export function withDaySettings(course: Course, dayNumber: number, settings: LessonSettings): Course {
  const old: LessonSettings = { readingLevel: course.readingLevel, language: course.language || DEFAULT_LANGUAGE };
  const switched = old.readingLevel !== settings.readingLevel || old.language !== settings.language;
  return {
    ...course,
    ...(switched ? { readingLevel: settings.readingLevel, language: settings.language } : {}),
    days: course.days.map((d) => {
      if (d.dayNumber === dayNumber) return { ...d, readingLevel: settings.readingLevel, language: settings.language };
      if (switched && d.lesson && !d.language) return { ...d, readingLevel: d.readingLevel || old.readingLevel, language: old.language };
      return d;
    }),
  };
}
