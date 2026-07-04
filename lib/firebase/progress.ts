"use client";

import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { db } from "./config";

/**
 * User-level progress that drives the Home shelf's streak + badges. Stored on
 * the /users/{uid} doc so it persists across every book (a course expiring
 * never costs you a badge or resets your streak).
 */
export interface UserProgress {
  /** Consecutive calendar days with at least one day-completion. */
  streakCount: number;
  /** Local calendar date ("YYYY-MM-DD") of the most recent completion. */
  lastActivityDate: string | null;
  /** Total books fully finished (all 7 days). Only ever increments. */
  booksFinished: number;
  /** Earned badge ids (see lib/badges.ts). */
  badges: string[];
}

export const DEFAULT_PROGRESS: UserProgress = {
  streakCount: 0,
  lastActivityDate: null,
  booksFinished: 0,
  badges: [],
};

/** Local "YYYY-MM-DD" for a date (not UTC — the streak follows the user's day). */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The date string for the day before `today` ("YYYY-MM-DD"). */
function previousDateStr(today: string): string {
  const t = new Date(today + "T00:00:00");
  t.setDate(t.getDate() - 1);
  return localDateStr(t);
}

/**
 * The streak as it stands *right now*. The stored streakCount is only rewritten
 * on completion, so a streak that has since lapsed would read stale — this
 * returns 0 once the last activity is older than yesterday.
 */
export function currentStreak(progress: UserProgress, now: Date): number {
  const today = localDateStr(now);
  const { lastActivityDate, streakCount } = progress;
  if (lastActivityDate === today || lastActivityDate === previousDateStr(today)) {
    return streakCount;
  }
  return 0;
}

/** Read a normalized progress object, filling any missing fields with defaults. */
function readProgress(data: Record<string, unknown> | undefined): UserProgress {
  return {
    streakCount: (data?.streakCount as number) ?? 0,
    lastActivityDate: (data?.lastActivityDate as string) ?? null,
    booksFinished: (data?.booksFinished as number) ?? 0,
    badges: (data?.badges as string[]) ?? [],
  };
}

export async function getUserProgress(uid: string): Promise<UserProgress> {
  const snap = await getDoc(doc(db, "users", uid));
  return readProgress(snap.exists() ? snap.data() : undefined);
}

/** The shape computeBackfill needs from a course — a subset of Course. */
interface BackfillCourse {
  days: { dayNumber: number; isCompleted: boolean }[];
}

/**
 * Derive any badges the user has ALREADY earned from their current courses, so
 * progress that predates this feature (or completions made before it shipped)
 * isn't lost. Streak can't be reconstructed (we never stored per-day dates), so
 * it's left untouched. Returns updated progress if anything changed, else null.
 * Only ever adds badges / raises booksFinished — never removes or lowers.
 */
export function computeBackfill(progress: UserProgress, courses: BackfillCourse[]): UserProgress | null {
  const badges = new Set(progress.badges);
  let finishedCount = 0;
  let anyCompleted = false;
  let anyHalfway = false;

  for (const c of courses) {
    if (c.days.some((d) => d.isCompleted)) anyCompleted = true;
    if (c.days.some((d) => d.isCompleted && d.dayNumber >= 4)) anyHalfway = true;
    if (c.days.length === 7 && c.days.every((d) => d.isCompleted)) finishedCount++;
  }

  if (anyCompleted) badges.add("first_steps");
  if (anyHalfway) badges.add("halfway");
  if (finishedCount > 0) badges.add("book_finished");

  const booksFinished = Math.max(progress.booksFinished, finishedCount);
  if (booksFinished >= 3) badges.add("bookworm");

  const changed = badges.size !== progress.badges.length || booksFinished !== progress.booksFinished;
  if (!changed) return null;

  return { ...progress, badges: [...badges], booksFinished };
}

/** Persist just the derived fields (badges + booksFinished) from a backfill. */
export async function persistBackfill(uid: string, progress: UserProgress): Promise<void> {
  await setDoc(
    doc(db, "users", uid),
    { badges: progress.badges, booksFinished: progress.booksFinished },
    { merge: true },
  );
}

/**
 * Record that the user just completed a day. Atomically bumps the streak,
 * awards any newly-earned badges, and (if the book is now finished) increments
 * the finished-books count. Returns the new progress for the UI to display.
 */
export async function recordDayCompletion(
  uid: string,
  opts: { dayLevel: number; finishedBook: boolean },
): Promise<UserProgress> {
  const ref = doc(db, "users", uid);
  const now = new Date();
  const today = localDateStr(now);
  const yesterday = previousDateStr(today);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = readProgress(snap.exists() ? snap.data() : undefined);

    // Streak: unchanged if already counted today, +1 if the last day was
    // yesterday, otherwise it resets to 1 (today starts a fresh streak).
    let streakCount: number;
    if (prev.lastActivityDate === today) {
      streakCount = prev.streakCount || 1;
    } else if (prev.lastActivityDate === yesterday) {
      streakCount = prev.streakCount + 1;
    } else {
      streakCount = 1;
    }

    const booksFinished = prev.booksFinished + (opts.finishedBook ? 1 : 0);

    // Badges — earned once, never removed.
    const badges = new Set(prev.badges);
    badges.add("first_steps"); // any completion means Day 1 is done
    if (opts.dayLevel >= 4) badges.add("halfway");
    if (opts.finishedBook) badges.add("book_finished");
    if (booksFinished >= 3) badges.add("bookworm");
    if (streakCount >= 3) badges.add("on_fire");

    const next: UserProgress = {
      streakCount,
      lastActivityDate: today,
      booksFinished,
      badges: [...badges],
    };

    tx.set(ref, next, { merge: true });
    return next;
  });
}
