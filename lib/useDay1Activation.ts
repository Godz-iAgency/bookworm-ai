"use client";

import { useEffect } from "react";
import { auth } from "./firebase/config";
import { postAuthed } from "./api-client";

/** Day 1 has to stay open this long to count as started, not just tapped. */
export const DAY1_DWELL_MS = 15_000;

const sent = new Set<string>();

/**
 * Reports "this reader started Day 1" once Day 1's lesson has been on screen
 * for DAY1_DWELL_MS. The server keeps only the first report per account
 * (lib/analytics-server.ts), so this only has to avoid being chatty: one call
 * per account per browser, remembered across reloads.
 *
 * Fire-and-forget. Nothing the reader sees waits on it or changes if it fails.
 */
export function useDay1Activation(courseId: string | null | undefined, open: boolean) {
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!open || !courseId || !uid) return;
    const key = `bw_day1_sent_${uid}`;
    if (sent.has(key)) return;
    try { if (localStorage.getItem(key)) { sent.add(key); return; } } catch { /* storage blocked: still report */ }
    const timer = setTimeout(async () => {
      if (sent.has(key)) return;
      sent.add(key);
      const res = await postAuthed<{ recorded?: boolean; error?: string }>("/api/analytics/day1", { courseId });
      if (res.error) { sent.delete(key); return; }
      try { localStorage.setItem(key, "1"); } catch { /* fine */ }
    }, DAY1_DWELL_MS);
    return () => clearTimeout(timer);
  }, [courseId, open]);
}
