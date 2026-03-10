"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Book {
  title: string;
  author: string;
  coverUrl: string;
  description: string;
}

export interface Day {
  dayNumber: number;
  title: string;
  previewText: string;
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
}

const BookwormContext = createContext<BookwormContextType | undefined>(undefined);

export function BookwormProvider({ children }: { children: ReactNode }) {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentReadingLevel, setCurrentReadingLevel] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

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
