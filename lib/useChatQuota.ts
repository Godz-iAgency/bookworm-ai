"use client";
import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";
import { useAuth } from "@/context/AuthContext";
/** Each reader can send this many messages per UTC day, per course. */
export const DAILY_CHAT_LIMIT = 10;
export interface ChatQuota { remaining: number; limitReached: boolean; consume: () => void; }
/** One dashboard owner, with Firestore reconciling other tabs/devices. */
export function useChatQuota(courseId: string | undefined): ChatQuota {
  const { user } = useAuth();
  const [day, setDay] = useState(() => new Date().toISOString().slice(0,10));
  const [used, setUsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setDay(new Date().toISOString().slice(0,10)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setUsed(0);
    if (!user || !courseId) return;
    return onSnapshot(doc(db, "users", user.uid, "aiUsage", day), snapshot => {
      setUsed(Number(snapshot.data()?.["chat_" + courseId] ?? 0));
    }, error => console.error("Could not load chat allowance:", error));
  }, [user, courseId, day]);
  const consume = useCallback(() => setUsed(n => n + 1), []);
  const remaining = Math.max(0, DAILY_CHAT_LIMIT - used);
  return { remaining, limitReached: remaining === 0, consume };
}
