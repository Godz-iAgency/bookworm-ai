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
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    email: d.email ?? null,
    displayName: d.displayName ?? null,
    photoURL: d.photoURL ?? null,
    readingLevel: d.readingLevel ?? null,
    genrePreferences: d.genrePreferences ?? [],
    lastBookRead: d.lastBookRead ?? null,
  };
}

/** Patch one or more editable profile fields on the user's Firestore doc. */
export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, "users", uid), data);
}
