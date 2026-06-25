"use client";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./config";

/**
 * Firebase auth helpers for Bookworm AI.
 * Google uses a popup on desktop and a redirect on mobile / Kindle (which
 * block popups). Email/password and password reset are also exposed here.
 * Every successful sign-in/up ensures the Firestore user document exists.
 */

function isMobileOrKindle(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Silk|Kindle/i.test(
    navigator.userAgent,
  );
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  if (isMobileOrKindle()) {
    // Redirect flow resolves after the page reloads; the AuthProvider's
    // onAuthStateChanged listener finishes ensuring the user document.
    await signInWithRedirect(auth, provider);
    return null;
  }
  const cred = await signInWithPopup(auth, provider);
  await ensureUserDocument(cred.user);
  return cred.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  await ensureUserDocument(cred.user, { authProvider: "password", displayName: displayName ?? null });
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(cred.user);
  return cred.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Creates the Firestore /users/{uid} document on first sign-in, using the
 * authoritative data model from the build spec. Idempotent: never overwrites
 * an existing document.
 */
export async function ensureUserDocument(
  user: User,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(ref, {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    authProvider: user.providerData[0]?.providerId ?? "password",
    createdAt: serverTimestamp(),
    readingLevel: null, // set during onboarding: 'explorer' | 'scholar' | 'architect'
    genrePreferences: [],
    plan: "free", // tier logic deferred — everyone is free for now
    booksThisWeek: 0,
    weekResetAt: serverTimestamp(),
    notificationTime: null,
    familyId: null,
    isFamilyOwner: false,
    ...extra,
  });
}
