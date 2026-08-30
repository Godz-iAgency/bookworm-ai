"use client";

import type { Book, Course, Day } from "./BookwormContext";

/**
 * Shared "call /api/course/generate and shape the response" logic, used by
 * both the direct-generate path (existing subscribers adding another book,
 * in app/reading-level/page.tsx) and the soft-gate preview
 * (app/preview/page.tsx, brand-new users before their card is on file).
 */
export interface GeneratedCourse {
  days: Day[];
  /** The outline's reading of the book, stored so later days inherit it. */
  thesis: string;
  frameworks: string[];
}

export async function generateCourseDays(
  title: string,
  author: string,
  readingLevel: string,
): Promise<GeneratedCourse | { error: string }> {
  try {
    const res = await fetch("/api/course/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author, readingLevel }),
    });
    const data = await res.json();

    if (!data || data.error || !Array.isArray(data.days) || data.days.length === 0) {
      return { error: data?.error || "We couldn't build your course right now. Please try again in a moment." };
    }

    const days: Day[] = data.days.slice(0, 7).map((d: any, i: number) => ({
      dayNumber: d.dayNumber ?? i + 1,
      title: d.title ?? `Day ${i + 1}`,
      previewText: d.previewText ?? "",
      // The anchors this day gets written from when the reader opens it.
      keyIdeas: Array.isArray(d.keyIdeas)
        ? d.keyIdeas.filter((k: unknown) => typeof k === "string").slice(0, 5)
        : [],
      lesson: d.lesson ?? "",
      flashcards: Array.isArray(d.flashcards) ? d.flashcards.slice(0, 3) : [],
      chatSeed: Array.isArray(d.chatSeed) ? d.chatSeed.slice(0, 3) : [],
      isUnlocked: i === 0,
      isCompleted: false,
    }));

    return {
      days,
      thesis: typeof data.thesis === "string" ? data.thesis : "",
      frameworks: Array.isArray(data.frameworks) ? data.frameworks : [],
    };
  } catch (e: any) {
    return { error: e.message || "We couldn't build your course right now. Please try again in a moment." };
  }
}

export function buildCourse(
  book: Book,
  readingLevel: string,
  days: Day[],
  thesis = "",
  frameworks: string[] = []
): Course {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 8);
  return {
    id: Math.random().toString(36).slice(2, 11),
    book,
    readingLevel,
    status: "active",
    days,
    expiresAt: expiresAt.toISOString(),
    thesis,
    frameworks,
  };
}
