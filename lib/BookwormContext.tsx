"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { buildSharedCourseView, type SharedFrom, type SharedProgress } from './book-club';

export interface Book {
  title: string;
  author: string;
  coverUrl: string;
  description: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface Day {
  dayNumber: number;
  title: string;
  previewText: string;
  /**
   * The specific concepts, frameworks, studies or stories this day covers,
   * captured by the outline before any lesson was written. Handed back to the
   * generator when this day is finally opened, which is what keeps a later day
   * about the book's actual fifth movement rather than about the topic in
   * general. Undefined on courses generated before the outline captured them.
   */
  keyIdeas?: string[];
  /** Full 800–1200 word AI-generated lesson (Phase 4). */
  lesson: string;
  /** Exactly 3 flashcards for this day. */
  flashcards: Flashcard[];
  /** 3 conversational starter questions to prime BookPal chat. */
  chatSeed: string[];
  /**
   * One line drawn from this day's own material, shown once the reader commits
   * to an action. Undefined on days generated before this existed; those get
   * one backfilled from their lesson the next time the day is opened.
   */
  closingAxiom?: string;
  /**
   * Which of the lesson's closing actions the reader said they would do in the
   * next 24 hours, as indices into that list. Stored so the commitment is still
   * there when they come back to the day, rather than resetting to nothing.
   */
  committedActions?: number[];
  isUnlocked: boolean;
  isCompleted: boolean;
}

export interface Course {
  id: string;
  book: Book;
  readingLevel: string;
  /**
   * The language this course was generated in, fixed when it was created.
   * Days 2-7 are written from this rather than from the reader's current
   * profile setting, so changing that setting later never leaves one course
   * half in two languages. Undefined on courses generated before languages
   * existed, which are English — see lib/languages.ts.
   */
  language?: string;
  status: 'active' | 'expired' | 'completed';
  days: Day[];
  expiresAt: string;
  /**
   * What the outline established about the book, kept so every later day is
   * generated against the same reading of it. Undefined on older courses.
   */
  thesis?: string;
  frameworks?: string[];
  /**
   * The day the reader most recently opened. Flashcards + Chat follow this so
   * they stay pinned to the last lesson read — they only change when the reader
   * opens a different day. Undefined on courses created before this field, or on
   * a brand-new course whose lesson hasn't been opened yet (the dashboard then
   * falls back to the first unlocked day).
   */
  activeDayNumber?: number;
  /**
   * Set only on the reader's own copy of a book another Book Club member
   * shared. Its presence is what keeps a shared book off the personal shelf
   * and out of the plan's open-book cap (see lib/book-club.ts); everything
   * else about it — loading, saving, expiry — is an ordinary course.
   */
  sharedFrom?: SharedFrom;
}

interface BookwormContextType {
  currentBook: Book | null;
  setCurrentBook: (book: Book | null) => void;
  currentReadingLevel: string | null;
  setCurrentReadingLevel: (level: string | null) => void;
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  /** Permanently remove a course from state + Firestore (frees a library slot). */
  deleteCourse: (courseId: string) => Promise<void>;
  /** True until the signed-in user's courses have been loaded from Firestore. */
  coursesLoading: boolean;
  /**
   * Start a live, read-only view of a book another Book Club member shared.
   * Subscribes directly to the sharer's own course plus this reader's private
   * progress on it, and keeps a merged Course in `courses` up to date as
   * either changes. Call the returned function to stop watching it.
   */
  openSharedBook: (shareId: string, sharedFrom: SharedFrom, ownerUid: string, courseId: string) => () => void;
}

const BookwormContext = createContext<BookwormContextType | undefined>(undefined);

/**
 * Is this Firestore document actually a course the app can use?
 *
 * A half-written or corrupted document used to be loaded like any other, and
 * the persistence effect below then called doc(..., course.id) with an
 * undefined id. Firestore throws a TypeError synchronously for that, from
 * inside an effect, which React treats as unrecoverable - so a SINGLE bad
 * document took down the entire app for that account, dashboard included,
 * with no way for the reader to get out of it.
 *
 * Only the fields the app would crash or render nonsense without are checked.
 * Deliberately NOT checked: status, thesis, frameworks and activeDayNumber,
 * which are legitimately absent on courses generated before those fields
 * existed. Requiring them would throw away perfectly good shelves.
 */
function isUsableCourse(value: unknown): value is Course {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<Course>;
  return (
    typeof c.id === 'string' &&
    c.id.length > 0 &&
    typeof c.book === 'object' &&
    c.book !== null &&
    typeof c.book.title === 'string' && typeof c.book.author === 'string' &&
    Array.isArray(c.days) && c.days.length === 7 && c.days.every((d, i) =>
      d && d.dayNumber === i + 1 && typeof d.title === 'string' && typeof d.lesson === 'string' &&
      Array.isArray(d.flashcards) && d.flashcards.every(card => card && typeof card.front === 'string' && typeof card.back === 'string') &&
      Array.isArray(d.chatSeed) && d.chatSeed.every(seed => typeof seed === 'string')) &&
    typeof c.expiresAt === 'string' &&
    !Number.isNaN(new Date(c.expiresAt).getTime())
  );
}

export function BookwormProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentReadingLevel, setCurrentReadingLevel] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const saved = useRef(new Map<string, Course>());
  const saveQueue = useRef(Promise.resolve());
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // Shared-book live views: one pair of Firestore listeners per open share
  // (the sharer's course + this reader's own progress on it), and the last
  // Course object built from them — set the moment either fires, so the
  // progress-autosave effect below never mistakes an incoming snapshot for a
  // local edit that still needs saving.
  const sharedSubs = useRef(new Map<string, () => void>());
  const sharedProgressSaved = useRef(new Map<string, Course>());

  // The uid whose courses currently live in `courses`. Persistence only writes
  // when this matches the signed-in user, so a previous account's courses can
  // NEVER be written under a new account — even if the user logs out and signs
  // up as someone else fast enough that the reload hasn't settled (that race
  // was leaking one account's books into another's Firestore collection).
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);

  // Load the user's saved courses on sign-in; clear them on sign-out.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      for (const unsub of sharedSubs.current.values()) unsub();
      sharedSubs.current.clear();
      sharedProgressSaved.current.clear();
      setCourses([]);
      setActiveCourseId(null);
      setHydratedUid(null);
      return;
    }

    let cancelled = false;
    // Immediately drop any previous account's courses and block persistence
    // until THIS user's courses have loaded.
    for (const unsub of sharedSubs.current.values()) unsub();
    sharedSubs.current.clear();
    sharedProgressSaved.current.clear();
    setHydratedUid(null);
    saved.current.clear();
    setCurrentBook(null);
    setCurrentReadingLevel(null);
    setCourses([]);
    setActiveCourseId(null);
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'courses'));
        if (cancelled) return;

        // Enforce the 8-day window: any course whose expiry has passed is
        // deleted from Firestore on load (no backend scheduler on this Firebase
        // app), so expired courses stop occupying library slots. Only the
        // still-active courses populate the shelf.
        const now = Date.now();
        const active: Course[] = [];
        for (const raw of snap.docs.map((d) => ({ ...d.data(), id: d.id }))) {
          if (!isUsableCourse(raw)) {
            // Left in Firestore rather than deleted: skipping costs nothing,
            // and destroying a reader's book on a shape guess cannot be undone
            // if this check ever turns out to be too strict.
            console.error('Skipping unreadable course document:', raw);
            continue;
          }
          const c = raw;
          if (new Date(c.expiresAt).getTime() < now) {
            deleteDoc(doc(db, 'users', user.uid, 'courses', c.id)).catch((err) =>
              console.error('Failed to delete expired course:', c.id, err)
            );
          } else {
            active.push(c);
          }
        }
        if (cancelled) return;
        saved.current = new Map(active.map(c => [c.id, c]));
        setCourses(active);
      } catch (err) {
        console.error('Failed to load courses:', err);
        if (!cancelled) setCourses([]);
      } finally {
        // Mark these courses as belonging to this user — unlocks persistence.
        if (!cancelled) setHydratedUid(user.uid);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Persist courses whenever they change — but only once the courses in state
  // were loaded for the CURRENT user (hydratedUid === user.uid). This guards
  // against both wiping saved data with the empty initial array AND writing a
  // previous account's stale courses into a different account.
  useEffect(() => {
    if (!user || hydratedUid !== user.uid) return;
    for (const course of courses) {
      // A shared book is a live view of someone else's course, never this
      // reader's own document — see the shared-progress effect below, which
      // is what actually persists a reader's side of it.
      if (course.sharedFrom) continue;
      // setCourses is exposed on this context, so anything can end up here.
      // Firestore throws synchronously on a missing id, and a throw inside an
      // effect unmounts the whole app - so this never reaches doc() unchecked.
      if (!isUsableCourse(course)) {
        console.error('Refusing to save a malformed course:', course);
        continue;
      }
      const before = saved.current.get(course.id);
      if (before === course) continue;
      saved.current.set(course.id, course);
      const uid = user.uid;
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (auth.currentUser?.uid !== uid) return;
        await runTransaction(db, async tx => {
          const ref = doc(db, 'users', uid, 'courses', course.id);
          const snapshot = await tx.get(ref);
          // A remotely deleted copy/course must never be resurrected by autosave.
          if (!snapshot.exists() && before) return;
          if (!snapshot.exists()) { tx.set(ref, course); return; }
          const remote = snapshot.data() as Course;
          const days = remote.days.map(d => {
            const incoming = course.days.find(n => n.dayNumber === d.dayNumber);
            if (!incoming) return d;
            return { ...d, lesson: d.lesson || incoming.lesson,
              flashcards: d.flashcards?.length ? d.flashcards : incoming.flashcards,
              chatSeed: d.chatSeed?.length ? d.chatSeed : incoming.chatSeed,
              closingAxiom: d.closingAxiom || incoming.closingAxiom || '',
              isCompleted: d.isCompleted || incoming.isCompleted,
              isUnlocked: d.isUnlocked || incoming.isUnlocked,
              committedActions: JSON.stringify(incoming.committedActions) !== JSON.stringify(before?.days.find(old => old.dayNumber === d.dayNumber)?.committedActions) ? incoming.committedActions ?? [] : d.committedActions ?? [],
            };
          });
          tx.update(ref, { days, status: days.every(d => d.isCompleted) ? 'completed' : remote.status,
            ...(course.activeDayNumber !== before?.activeDayNumber && course.activeDayNumber ? { activeDayNumber: course.activeDayNumber } : {}) });
        });
      }).catch(err => { saved.current.delete(course.id); console.error('Failed to save course:', course.id, err); });
    }
  }, [courses, hydratedUid, user]);

  // A reader's own progress on a shared book — which days they've completed,
  // their commitments, which day they're on. Parallels the autosave effect
  // above, but writes only these fields, to sharedProgress rather than the
  // course itself (which the reader has no permission to touch). Skipped
  // entirely for anything just received FROM Firestore: openSharedBook marks
  // that object as already-saved the moment it builds it, below.
  useEffect(() => {
    if (!user || hydratedUid !== user.uid) return;
    for (const course of courses) {
      if (!course.sharedFrom) continue;
      const before = sharedProgressSaved.current.get(course.id);
      if (before === course) continue;
      sharedProgressSaved.current.set(course.id, course);
      const uid = user.uid;
      const shareId = course.id;
      const completedDays = course.days.filter(d => d.isCompleted).map(d => d.dayNumber);
      const committedActionsByDay: Record<string, number[]> = {};
      for (const d of course.days) if (d.committedActions?.length) committedActionsByDay[String(d.dayNumber)] = d.committedActions;
      // Firestore's client SDK throws on an `undefined` field value (no
      // ignoreUndefinedProperties here), and activeDayNumber starts out
      // exactly that — before the reader has opened any day.
      const progress: SharedProgress = { completedDays, committedActionsByDay, activeDayNumber: course.activeDayNumber ?? null };
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        if (auth.currentUser?.uid !== uid) return;
        await setDoc(doc(db, 'users', uid, 'sharedProgress', shareId), progress, { merge: true });
      }).catch(err => { sharedProgressSaved.current.delete(course.id); console.error('Failed to save shared progress:', course.id, err); });
    }
  }, [courses, hydratedUid, user]);

  useEffect(() => {
    if (!user || hydratedUid !== user.uid) return;
    return onSnapshot(collection(db, 'users', user.uid, 'courses'), snapshot => {
      if (snapshot.metadata.hasPendingWrites) return;
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          saved.current.delete(change.doc.id);
          setCourses(prev => prev.filter(c => c.id !== change.doc.id));
        }
      }
    }, error => console.error('Shelf subscription failed:', error));
  }, [user, hydratedUid]);

  const coursesLoading = authLoading || (!!user && hydratedUid !== user.uid);

  // Remove a course everywhere: Firestore first, then local state. Clears the
  // active selection if it was the one removed (the dashboard re-selects).
  //
  // A shared book has no document of this reader's own course collection to
  // delete — it was never copied there — but it DOES have this reader's own
  // progress doc, and that has to go too: CourseDetail promises removing one
  // means starting over from day one, which would be a lie if progress just
  // sat there waiting to resume the moment they reopened it.
  const deleteCourse = async (courseId: string) => {
    // An empty path segment is the same synchronous Firestore throw as above.
    if (!courseId) return;
    if (courses.find((c) => c.id === courseId)?.sharedFrom) {
      sharedSubs.current.get(courseId)?.();
      if (user) deleteDoc(doc(db, 'users', user.uid, 'sharedProgress', courseId)).catch(err => console.error('Failed to clear shared progress:', courseId, err));
    } else if (user) {
      await saveQueue.current;
      await deleteDoc(doc(db, 'users', user.uid, 'courses', courseId));
      saved.current.delete(courseId);
    }
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    setActiveCourseId((prev) => (prev === courseId ? null : prev));
  };

  // Watch a book someone else shared: live off their course document, merged
  // with this reader's own private progress on it. Both listeners feed the
  // same recompute, so a new lesson generated on the other end and a day this
  // reader just completed locally both land through the same path.
  const openSharedBook = (shareId: string, sharedFrom: SharedFrom, ownerUid: string, courseId: string) => {
    const existing = sharedSubs.current.get(shareId);
    if (existing) return existing;

    let ownerCourse: Course | null = null;
    let progress: SharedProgress | null = null;
    const readerUid = user?.uid;

    const recompute = () => {
      if (!ownerCourse) return;
      const view = buildSharedCourseView(shareId, sharedFrom, ownerCourse, progress);
      // Set BEFORE setCourses: the progress-autosave effect diffs against
      // this on its very next run, so a view built from Firestore is never
      // mistaken for a local edit still waiting to be saved.
      sharedProgressSaved.current.set(shareId, view);
      setCourses(prev => {
        const idx = prev.findIndex(c => c.id === shareId);
        if (idx === -1) return [...prev, view];
        const next = prev.slice();
        next[idx] = view;
        return next;
      });
    };

    const unsubCourse = onSnapshot(doc(db, 'users', ownerUid, 'courses', courseId), snap => {
      if (!snap.exists()) {
        // Withdrawn, expired, or the sharer deleted it — either way, gone.
        setCourses(prev => prev.filter(c => c.id !== shareId));
        unsubscribe();
        return;
      }
      ownerCourse = { ...(snap.data() as Course), id: courseId };
      recompute();
    }, error => console.error('Shared book subscription failed:', error));

    const unsubProgress = readerUid
      ? onSnapshot(doc(db, 'users', readerUid, 'sharedProgress', shareId), snap => {
          progress = snap.exists() ? (snap.data() as SharedProgress) : null;
          recompute();
        }, error => console.error('Shared progress subscription failed:', error))
      : () => {};

    const unsubscribe = () => {
      unsubCourse();
      unsubProgress();
      sharedSubs.current.delete(shareId);
      sharedProgressSaved.current.delete(shareId);
    };
    sharedSubs.current.set(shareId, unsubscribe);
    return unsubscribe;
  };

  return (
    <BookwormContext.Provider
      value={{
        currentBook,
        setCurrentBook,
        currentReadingLevel,
        setCurrentReadingLevel,
        courses,
        setCourses,
        activeCourseId,
        setActiveCourseId,
        deleteCourse,
        coursesLoading,
        openSharedBook,
      }}
    >
      {children}
    </BookwormContext.Provider>
  );
}

export function useBookwormContext() {
  const context = useContext(BookwormContext);
  if (context === undefined) {
    throw new Error('useBookwormContext must be used within a BookwormProvider');
  }
  return context;
}
