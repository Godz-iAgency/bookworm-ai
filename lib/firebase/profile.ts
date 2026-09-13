"use client";

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./config";

/**
 * The subset of the /users/{uid} document the Profile screen reads + edits.
 * (The full doc has more fields — plan, familyId, etc. — managed elsewhere.)
 */
export interface UserProfile {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  readingLevel: string | null;
  genrePreferences: string[];
  lastBookRead: string | null;
  plan: string | null;
  /** Lesson text size — see lib/reading-prefs.ts. */
  readingFontSize: string | null;
  /** "scroll" or "page" — how lessons are paged through. */
  readingMode: string | null;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    email: typeof d.email === "string" ? d.email : null,
    displayName: typeof d.displayName === "string" ? d.displayName : null,
    photoURL: typeof d.photoURL === "string" ? d.photoURL : null,
    readingLevel: typeof d.readingLevel === "string" ? d.readingLevel : null,
    genrePreferences: Array.isArray(d.genrePreferences) ? d.genrePreferences.filter((v: unknown) => typeof v === "string") : [],
    lastBookRead: typeof d.lastBookRead === "string" ? d.lastBookRead : null,
    plan: typeof d.plan === "string" ? d.plan : null,
    readingFontSize: typeof d.readingFontSize === "string" ? d.readingFontSize : null,
    readingMode: typeof d.readingMode === "string" ? d.readingMode : null,
  };
}

/** Patch one or more editable profile fields on the user's Firestore doc. */
export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}
