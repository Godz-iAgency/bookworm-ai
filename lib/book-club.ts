import type { Course } from "./BookwormContext";
import { planFromId } from "./plans";

/**
 * Book Club: the shared shelf sitting beside each member's personal one.
 *
 * The club itself already existed before any of this — /families/{id} holds
 * the roster, membership grants the tier (see getEffectivePlanId), and invites
 * are redeemed by /api/family/join. What's here is the sharing layer built on
 * top: a member deliberately puts one of their books on the club's shelf, and
 * the other members can study that already-generated course without spending a
 * generation of their own.
 *
 * Where the data lives, and why:
 *
 *   /families/{familyId}/sharedBooks/{shareId}
 *     The shared course itself, snapshotted at the moment it was shared.
 *     Admin SDK only (firestore.rules denies clients outright), so a stranger
 *     who guesses a familyId still reads nothing — every route below checks
 *     the caller is actually on the roster first.
 *
 *   /users/{uid}/courses/{shareId}
 *     Each reader's OWN copy, made the first time they open a shared book, and
 *     tagged with `sharedFrom`. Their progress is independent because it is
 *     simply their document — no shared mutable progress to keep untangled.
 *     Living in the existing courses collection is deliberate: loading,
 *     saving, the countdown and the 7-day expiry sweep all work on it unchanged
 *     and needed no new security rule. It is excluded from the personal
 *     shelf cap by `sharedFrom` alone (see personalCourses).
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
  expiresAt: string;
  /** True when the signed-in reader is the one who shared it. */
  isMine: boolean;
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

/** Copies of books other members put on the club's shelf. */
export function sharedCourses(courses: Course[]): Course[] {
  return courses.filter((c) => !!c.sharedFrom);
}

/**
 * The id a share gets: one reader, one of their courses.
 *
 * Derived rather than random so both ends can work it out without a lookup —
 * the detail screen asking "is this book already shared?", and the share route
 * making re-sharing the same book a harmless overwrite instead of a duplicate.
 * It is also the id of every reader's copy, which is what lets a withdrawal
 * find and delete those copies.
 */
export function shareIdFor(uid: string, courseId: string): string {
  return `${uid}_${courseId}`;
}

/** Whole days left before a removed member's account is deleted (never negative). */
export function daysUntil(deadlineIso: string, now: Date = new Date()): number {
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
