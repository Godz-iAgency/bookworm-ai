"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Course, Day } from "./BookwormContext";

export type DayContentStatus = "ready" | "generating" | "error";

/**
 * Guarantees the active day has everything the Flashcards and Chat tabs need,
 * regardless of whether the reader ever opened the Course tab.
 *
 * Two repair paths:
 *  - no lesson at all (days 2–7 before they're opened) → generate the full day
 *  - lesson present but an empty deck → rebuild only the cards, leaving the
 *    lesson the reader already read untouched
 *
 * IMPORTANT: this must have exactly one caller. The dashboard mounts Course,
 * Chat and Flashcards simultaneously (they're toggled with CSS, not
 * unmounted), so calling this from each tab would fire duplicate generations
 * for the same day.
 */
export function useDayContent(
  course: Course | undefined,
  day: Day | undefined,
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>,
  /**
   * Only generate while the reader is actually inside a course. Guards against
   * spending a generation on someone who just opened their shelf and left.
   */
  enabled: boolean
): { status: DayContentStatus; retry: () => void } {
  // Days we've already auto-attempted, as "courseId:dayNumber". Without this
  // a generation that keeps coming back empty would re-trigger the effect
  // forever, hammering the API. One automatic try, then it's manual retry only.
  const attemptedRef = useRef<Set<string>>(new Set());
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const key = course && day ? `${course.id}:${day.dayNumber}` : "";
  const hasLesson = !!day?.lesson;
  const hasCards = (day?.flashcards?.length ?? 0) > 0;
  // Locked days are never generated — the reader hasn't earned them yet.
  const needsContent = enabled && !!day?.isUnlocked && (!hasLesson || !hasCards);

  const run = useCallback(
    async (force: boolean) => {
      if (!enabled || !course || !day || !day.isUnlocked) return;

      const needsFull = !day.lesson;
      const needsCards = !needsFull && (day.flashcards?.length ?? 0) === 0;
      if (!needsFull && !needsCards) return;

      const attemptKey = `${course.id}:${day.dayNumber}`;
      if (!force && attemptedRef.current.has(attemptKey)) return;
      attemptedRef.current.add(attemptKey);
      setFailedKey(null);

      try {
        const endpoint = needsFull ? "/api/course/day" : "/api/course/flashcards";
        const body = needsFull
          ? {
              title: course.book.title,
              author: course.book.author,
              readingLevel: course.readingLevel,
              dayNumber: day.dayNumber,
              dayTitle: day.title,
              allTitles: course.days.map((d) => d.title),
              // What the outline established about this book. Without these a
              // day generated here would be written from the title alone,
              // which is exactly the generic-summary failure the outline's key
              // ideas exist to prevent.
              thesis: course.thesis ?? "",
              frameworks: course.frameworks ?? [],
              keyIdeas: day.keyIdeas ?? [],
            }
          : {
              title: course.book.title,
              author: course.book.author,
              readingLevel: course.readingLevel,
              dayNumber: day.dayNumber,
              dayTitle: day.title,
              lesson: day.lesson,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        if (!(data.flashcards?.length > 0)) throw new Error("No flashcards returned");

        setCourses((prev) =>
          prev.map((c) =>
            c.id !== course.id
              ? c
              : {
                  ...c,
                  days: c.days.map((d) =>
                    d.dayNumber !== day.dayNumber
                      ? d
                      : {
                          ...d,
                          // Only fill the lesson on the full path — the repair
                          // path must leave an already-read lesson alone.
                          lesson: needsFull ? data.lesson ?? d.lesson : d.lesson,
                          flashcards: data.flashcards,
                          chatSeed: data.chatSeed?.length ? data.chatSeed : d.chatSeed,
                        }
                  ),
                }
          )
        );
      } catch (err) {
        console.error("Day content generation failed:", err);
        setFailedKey(attemptKey);
      }
    },
    [course, day, setCourses, enabled]
  );

  useEffect(() => {
    run(false);
  }, [run]);

  const retry = useCallback(() => {
    void run(true);
  }, [run]);

  const status: DayContentStatus = !needsContent
    ? "ready"
    : failedKey === key
      ? "error"
      : "generating";

  return { status, retry };
}
