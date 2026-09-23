"use client";

import { aiFetch } from "@/lib/ai-fetch";
import type { Book, Course, Day } from "./BookwormContext";

/**
 * Shared "call /api/course/generate and shape the response" logic, used by
 * both the direct-generate path (existing subscribers adding another book,
 * in app/reading-level/page.tsx) and the soft-gate preview
 * (app/preview/page.tsx, brand-new users before their card is on file).
 */
export interface GeneratedCourse {
  days: Day[];
  generationId?: string;
  /** The outline's reading of the book, stored so later days inherit it. */
  thesis: string;
  frameworks: string[];
}

export async function generateCourseDays(
  title: string,
  author: string,
  readingLevel: string,
  language: string,
): Promise<GeneratedCourse | { error: string }> {
  try {
    const res = await aiFetch("/api/course/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author, readingLevel, language }),
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
        ? d.keyIdeas.filter((k: unknown) => typeof k === "string").slice(0, 6)
        : [],
      // "" rather than undefined throughout: Firestore rejects undefined values.
      coreConcept: typeof d.coreConcept === "string" ? d.coreConcept : "",
      learningObjective: typeof d.learningObjective === "string" ? d.learningObjective : "",
      bookConnection: typeof d.bookConnection === "string" ? d.bookConnection : "",
      // Every lesson, Day 1 included, is written when the day is opened.
      lesson: d.lesson ?? "",
      flashcards: Array.isArray(d.flashcards) ? d.flashcards.slice(0, 3) : [],
      chatSeed: Array.isArray(d.chatSeed) ? d.chatSeed.slice(0, 3) : [],
      // "" rather than undefined: Firestore rejects undefined values, and days
      // 2-7 legitimately have no axiom until they are opened and written.
      closingAxiom: typeof d.closingAxiom === "string" ? d.closingAxiom : "",
      isUnlocked: i === 0,
      isCompleted: false,
    }));

    return {
      days,
      generationId: data.generationId,
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
  language: string,
  days: Day[],
  thesis = "",
  frameworks: string[] = [],
  generationId?: string
): Course {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 8);
  return {
    id: generationId ?? crypto.randomUUID(),
    book,
    readingLevel,
    // Fixed here, for the life of the course. Later days read this, never the
    // reader's current profile setting.
    language,
    status: "active",
    days,
    expiresAt: expiresAt.toISOString(),
    thesis,
    frameworks,
  };
}
