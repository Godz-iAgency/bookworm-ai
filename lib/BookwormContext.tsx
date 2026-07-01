"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

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
  /** Full 800–1200 word AI-generated lesson (Phase 4). */
  lesson: string;
  /** Exactly 3 flashcards for this day. */
  flashcards: Flashcard[];
  /** 3 conversational starter questions to prime BookPal chat. */
  chatSeed: string[];
  isUnlocked: boolean;
  isCompleted: boolean;
}

export interface Course {
  id: string;
  book: Book;
  readingLevel: string;
  status: 'active' | 'expired' | 'completed';
  days: Day[];
  expiresAt: string;
  /**
   * The day the reader most recently opened. Flashcards + Chat follow this so
   * they stay pinned to the last lesson read — they only change when the reader
   * opens a different day. Undefined on courses created before this field, or on
   * a brand-new course whose lesson hasn't been opened yet (the dashboard then
   * falls back to the first unlocked day).
   */
  activeDayNumber?: number;
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
  /** True until the signed-in user's courses have been loaded from Firestore. */
  coursesLoading: boolean;
}

const BookwormContext = createContext<BookwormContextType | undefined>(undefined);

export function BookwormProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentReadingLevel, setCurrentReadingLevel] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // Tracks whether we've completed the initial Firestore load for this user.
  // Persistence is blocked until this is true so the empty initial state can
  // never overwrite real saved courses (silent data loss).
  const [hydrated, setHydrated] = useState(false);

  // Load the user's saved courses on sign-in; clear them on sign-out.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setCourses([]);
      setActiveCourseId(null);
      setHydrated(false);
      return;
    }

    let cancelled = false;
    setHydrated(false);
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'courses'));
        if (cancelled) return;
        setCourses(snap.docs.map((d) => d.data() as Course));
      } catch (err) {
        console.error('Failed to load courses:', err);
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Persist courses whenever they change — but only after the initial load, so
  // the starting empty array can't wipe out what's already in Firestore.
  useEffect(() => {
    if (!hydrated || !user) return;
    for (const course of courses) {
      setDoc(doc(db, 'users', user.uid, 'courses', course.id), course).catch((err) =>
        console.error('Failed to save course:', course.id, err)
      );
    }
  }, [courses, hydrated, user]);

  const coursesLoading = authLoading || (!!user && !hydrated);

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
        coursesLoading,
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
