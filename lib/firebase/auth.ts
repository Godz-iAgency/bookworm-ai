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

export async function signInWithGoogle(): Promise<{ user: User | null; isNew: boolean }> {
  const provider = new GoogleAuthProvider();
  if (isMobileOrKindle()) {
    // Redirect flow resolves after the page reloads; the AuthProvider's
    // onAuthStateChanged listener finishes ensuring the user document.
    await signInWithRedirect(auth, provider);
    return { user: null, isNew: false };
  }
  const cred = await signInWithPopup(auth, provider);
  // isNew tells the caller whether this was a first-time account, so brand-new
  // Google users can be routed through onboarding just like email signups.
  const isNew = await ensureUserDocument(cred.user);
  return { user: cred.user, isNew };
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
 * an existing document. Returns true if it created the doc (a brand-new
 * account), false if the user already existed.
 */
export async function ensureUserDocument(
  user: User,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;

  await setDoc(ref, {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    authProvider: user.providerData[0]?.providerId ?? "password",
    createdAt: serverTimestamp(),
    readingLevel: null, // set during onboarding: 'explorer' | 'scholar' | 'architect'
    genrePreferences: [],
    plan: "free", // 'free' | 'page_turner' | 'well_read' | 'book_club'
    // Billing (see lib/billing.ts). trialStatus is absent/null until the
    // soft gate collects a card — its absence means "hasn't committed yet".
    trialStatus: null, // 'active' | 'converted' | 'cancelled' | 'expired'
    trialStartedAt: null,
    trialEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePaymentMethodId: null,
    generationsThisMonth: 0,
    monthResetAt: null,
    showTrialEndWarning: false,
    reminderEmailSentAt: null,
    notificationTime: null,
    familyId: null,
    isFamilyOwner: false,
    ...extra,
  });
  return true;
}
