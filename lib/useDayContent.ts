"use client";

import { aiFetch } from "@/lib/ai-fetch";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Course, Day } from "./BookwormContext";

export type DayContentStatus = "ready" | "generating" | "error";

/**
 * Guarantees the active day has everything the Flashcards and Chat tabs need,
 * regardless of whether the reader ever opened the Course tab.
 *
 * Two repair paths:
 *  - no lesson at all (any day before it's opened, Day 1 included) → generate the full day
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
  // Days written before axioms existed have a lesson and a deck but nothing to
  // close on, so a missing axiom is a repairable gap like an empty deck is.
  const hasAxiom = !!day?.closingAxiom;
  const hasStarters = (day?.chatSeed?.length ?? 0) > 0;
  // Locked days are never generated — the reader hasn't earned them yet.
  const needsContent = enabled && !!day?.isUnlocked && (!hasLesson || !hasCards || !hasAxiom || !hasStarters);

  const run = useCallback(
    async (force: boolean) => {
      if (!enabled || !course || !day || !day.isUnlocked) return;

      const needsFull = !day.lesson;
      const needsRepair =
        !needsFull && ((day.flashcards?.length ?? 0) === 0 || !day.closingAxiom || !(day.chatSeed?.length));
      if (!needsFull && !needsRepair) return;

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
              arc: course.days.map((d) => ({ title: d.title, coreConcept: d.coreConcept ?? "" })),
              // What the outline established about this book. Without these a
              // day generated here would be written from the title alone,
              // which is exactly the generic-summary failure the outline's key
              // ideas exist to prevent.
              thesis: course.thesis ?? "",
              frameworks: course.frameworks ?? [],
              keyIdeas: day.keyIdeas ?? [],
              coreConcept: day.coreConcept ?? "",
              learningObjective: day.learningObjective ?? "",
              bookConnection: day.bookConnection ?? "",
            }
          : {
              title: course.book.title,
              author: course.book.author,
              readingLevel: course.readingLevel,
              dayNumber: day.dayNumber,
              dayTitle: day.title,
              lesson: day.lesson,
            };

        const res = await aiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The course's own language, not the reader's current setting: a book
          // started in English stays English even after they switch.
          body: JSON.stringify({ ...body, courseId: course.id, language: course.language ?? "en" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        if (!(data.chatSeed?.length > 0)) throw new Error("No chat starters returned");
        if (!(data.flashcards?.length > 0)) throw new Error("No flashcards returned");
        // A successful HTTP response can still omit a required field. Without
        // failing this attempt, the one-attempt guard leaves status stuck at
        // "generating" forever instead of enabling the existing retry path.
        if (needsFull && !(typeof data.lesson === "string" && data.lesson.trim())) {
          throw new Error("No lesson returned");
        }
        if (!day.closingAxiom && !(typeof data.closingAxiom === "string" && data.closingAxiom.trim())) {
          throw new Error("No closing axiom returned");
        }

        setCourses((prev) =>
          prev.map((c) =>
            c.id !== course.id
              ? c
              : {
                  ...c,
                  // Fill gaps, never overwrite. On the full path every one of
                  // these is empty anyway, so it takes what was just written;
                  // on a repair path it keeps what the reader already has —
                  // the lesson they read, and cards they may be part-way
                  // through — and only fills what was actually missing. That
                  // matters now that a missing axiom alone can trigger this.
                  days: c.days.map((d) =>
                    d.dayNumber !== day.dayNumber
                      ? d
                      : {
                          ...d,
                          lesson: d.lesson || data.lesson || "",
                          flashcards: d.flashcards?.length ? d.flashcards : data.flashcards ?? [],
                          chatSeed: d.chatSeed?.length ? d.chatSeed : data.chatSeed ?? [],
                          closingAxiom: d.closingAxiom || data.closingAxiom || "",
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
