"use client";

import { useState, useEffect, useCallback } from "react";

/** Each reader can send this many messages to BookPal per day, per course. */
export const DAILY_CHAT_LIMIT = 10;

// Scoped to this course AND today's date, so the count resets by itself when a
// new day starts without needing any cleanup.
function dailyKey(courseId: string) {
  const d = new Date();
  const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return `bookpal_chat_${courseId}_${day}`;
}

export interface ChatQuota {
  remaining: number;
  limitReached: boolean;
  consume: () => void;
}

/**
 * Today's remaining BookPal messages for a course.
 *
 * This must have a single caller (the dashboard), which passes the result down
 * to ChatTab. The count is displayed in the top bar but spent inside the chat,
 * and two independent copies of this state would drift apart the moment a
 * message was sent.
 */
export function useChatQuota(courseId: string | undefined): ChatQuota {
  const [used, setUsed] = useState(0);

  // Read in an effect, not a useState initializer: localStorage doesn't exist
  // during SSR and reading it while rendering would break hydration.
  useEffect(() => {
    if (!courseId) return;
    const stored = localStorage.getItem(dailyKey(courseId));
    setUsed(stored ? parseInt(stored, 10) || 0 : 0);
  }, [courseId]);

  const consume = useCallback(() => {
    if (!courseId) return;
    setUsed((prev) => {
      const next = prev + 1;
      localStorage.setItem(dailyKey(courseId), String(next));
      return next;
    });
  }, [courseId]);

  const remaining = Math.max(0, DAILY_CHAT_LIMIT - used);
  return { remaining, limitReached: remaining <= 0, consume };
}
