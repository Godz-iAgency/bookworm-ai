import type { Course } from "./BookwormContext";
import { planFromId } from "./plans";

/**
 * Book Club: the shared shelf sitting beside each member's personal one.
 *
 * The club itself already existed before any of this — /families/{id} holds
 * the roster, membership grants the tier (see getEffectivePlanId), and invites
 * are redeemed by /api/family/join. What's here is the sharing layer built on
 * top: a member deliberately puts one of their books on the club's shelf, and
 * the other members read it live — whatever the sharer has generated so far,
 * updating the moment they generate more — without spending a generation of
 * their own, and without ever being able to change a word of it.
 *
 * Where the data lives, and why:
 *
 *   /families/{familyId}/sharedBooks/{shareId}
 *     A pointer, not a copy: {sharedByUid, sourceCourseId, sharedAt}. Admin
 *     SDK only (firestore.rules denies clients outright), so a stranger who
 *     guesses a familyId still reads nothing — every route below checks the
 *     caller is actually on the roster first. Its existence is also what
 *     firestore.rules checks (isSharedWithReader) to let a fellow member read
 *     the sharer's course document directly — see /users/{uid}/courses below.
 *
 *   /users/{sharerUid}/courses/{courseId}
 *     The sharer's own book, unmodified. A fellow member reads this SAME
 *     document live — no copy, no lag — the instant a share pointer exists
 *     for it and both accounts are in the same family. Never a target for a
 *     member's writes: firestore.rules' courses match grants read only.
 *
 *   /users/{uid}/sharedProgress/{shareId}
 *     Each reader's OWN reading progress on a shared book — which days they
 *     have unlocked/completed, their own commitments. Ordinary per-user
 *     ownership; nothing here is ever visible to anyone but that one reader.
 */

/** Where a shared copy came from. Present only on a copy, never on an original. */
export interface SharedFrom {
  shareId: string;
  familyId: string;
  sharedByUid: string;
  sharedByName: string;
}

export interface ClubMember {
  uid: string;
  name: string;
  isOwner: boolean;
  /** True for the signed-in reader's own row. */
  isYou: boolean;
}

export interface SharedBookSummary {
  shareId: string;
  title: string;
  author: string;
  coverUrl: string;
  readingLevel: string;
  sharedByUid: string;
  sharedByName: string;
  /** The sharer's own course id — what a reader's live listener subscribes to. */
  sourceCourseId: string;
  expiresAt: string;
  /** True when the signed-in reader is the one who shared it. */
  isMine: boolean;
}

/** A reader's own progress on a book someone else shared — never anyone else's. */
export interface SharedProgress {
  /** Day numbers (1-7) this reader has personally marked complete. */
  completedDays: number[];
  /** Per-day committed-action indices, keyed by day number as a string. */
  committedActionsByDay?: Record<string, number[]>;
  /** Firestore stores absent-so-far as null: the client SDK rejects `undefined`. */
  activeDayNumber?: number | null;
}

/**
 * Whether this reader may open a given day of a shared book.
 *
 * Capped twice: by what the sharer has actually generated (a day with no
 * lesson yet does not exist for anyone but them), and by this reader's own
 * pace through it (day 1, or the day after one they have completed) — the
 * same "unlock as you finish" rhythm as a personal book, just never able to
 * outrun the sharer's own generation.
 */
export function isSharedDayUnlocked(dayNumber: number, sharerDayHasLesson: boolean, completedDays: number[]): boolean {
  if (!sharerDayHasLesson) return false;
  return dayNumber === 1 || completedDays.includes(dayNumber - 1);
}

/** What /api/family/overview answers with. */
export type ClubOverview =
  | { inClub: false }
  | {
      inClub: true;
      familyId: string;
      isOwner: boolean;
      maxMembers: number;
      seatsAvailable: number;
      members: ClubMember[];
      sharedBooks: SharedBookSummary[];
    };

export const BOOK_CLUB_MAX_MEMBERS = planFromId("book_club").maxMembers ?? 4;

/** How long a removed member has to pick a plan before the account is deleted. */
export const CONVERSION_WINDOW_DAYS = 7;

/**
 * The reader's own books — everything the plan's open-book cap counts.
 *
 * A shared book deliberately does not count: it cost the reader neither a
 * generation nor a slot, so letting it fill one would mean a club of four
 * quietly locking each other out of their own shelves.
 */
export function personalCourses(courses: Course[]): Course[] {
  return courses.filter((c) => !c.sharedFrom);
}

/** Live views of books other members put on the club's shelf — never copies. */
export function sharedCourses(courses: Course[]): Course[] {
  return courses.filter((c) => !!c.sharedFrom);
}

/**
 * The id a share gets: one reader, one of their courses.
 *
 * Derived rather than random so both ends can work it out without a lookup —
 * the detail screen asking "is this book already shared?", and the share route
 * making re-sharing the same book a harmless overwrite instead of a duplicate.
 * It is also the id a reader's live view is held under locally, and the doc id
 * of that reader's own progress on it.
 */
export function shareIdFor(uid: string, courseId: string): string {
  return `${uid}_${courseId}`;
}

/**
 * Build the Course-shaped object the existing reading UI already knows how to
 * render, entirely in memory — this is never written back to Firestore as
 * this shape (see BookwormContext's autosave, which skips anything carrying
 * `sharedFrom`).
 *
 * Content (lesson, flashcards, chatSeed, closingAxiom, book, thesis...) comes
 * straight from the sharer's own course, live. Progress (which days are
 * unlocked/completed, committed actions, which day is active) comes entirely
 * from this reader's own, private sharedProgress doc — the two are stitched
 * together fresh on every change to either source.
 */
export function buildSharedCourseView(
  shareId: string,
  sharedFrom: SharedFrom,
  ownerCourse: Course,
  progress: SharedProgress | null,
): Course {
  const completedDays = progress?.completedDays ?? [];
  return {
    ...ownerCourse,
    id: shareId,
    sharedFrom,
    activeDayNumber: progress?.activeDayNumber ?? undefined,
    days: ownerCourse.days.map((day) => ({
      ...day,
      isUnlocked: isSharedDayUnlocked(day.dayNumber, !!day.lesson, completedDays),
      isCompleted: completedDays.includes(day.dayNumber),
      committedActions: progress?.committedActionsByDay?.[String(day.dayNumber)] ?? [],
    })),
  };
}

/** Whole days left before a removed member's account is deleted (never negative). */
export function daysUntil(deadlineIso: string, now: Date = new Date()): number {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
