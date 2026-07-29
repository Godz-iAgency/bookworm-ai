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

/**
 * Google sign-in, popup first — including on phones and tablets.
 *
 * This used to force signInWithRedirect on every mobile user agent, which
 * silently failed there: the app is served from vercel.app while Firebase's
 * auth handler lives on <project>.firebaseapp.com, and the redirect flow has
 * to carry state between those two origins. Mobile browsers now partition
 * that cross-site storage, so the round trip came back with no user and no
 * error — tapping the button just returned you to the same screen.
 *
 * Popups don't need cross-origin storage and are allowed on modern mobile
 * browsers when opened from a real tap. Redirect stays as the fallback for
 * the environments that genuinely can't open one (in-app webviews, older
 * Kindle browsers), where getRedirectResult in AuthContext completes it.
 */
export async function signInWithGoogle(): Promise<{ user: User | null; isNew: boolean }> {
  const provider = new GoogleAuthProvider();

  try {
    const cred = await signInWithPopup(auth, provider);
    // isNew tells the caller whether this was a first-time account, so brand-new
    // Google users can be routed through onboarding just like email signups.
    const isNew = await ensureUserDocument(cred.user);
    return { user: cred.user, isNew };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";

    // The reader deliberately dismissed it — surface that rather than
    // bouncing them out of the app into a redirect they didn't ask for.
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      throw err;
    }

    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, provider);
      return { user: null, isNew: false };
    }

    throw err;
  }
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

/**
 * Turns a Firebase auth error into something the reader can act on. The
 * generic "please try again" hid a real, fixable misconfiguration
 * (unauthorized-domain) that left mobile Google sign-in looking like it
 * simply did nothing.
 */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/unauthorized-domain":
      return "This site's address isn't approved for Google sign-in yet. Add it in Firebase → Authentication → Settings → Authorized domains.";
    case "auth/account-exists-with-different-credential":
      return "You already have an account with this email. Sign in with your email and password instead.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in window. Allow pop-ups for this site, or try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google sign-in window closed before finishing. Please try again.";
    case "auth/network-request-failed":
      return "We couldn't reach Google. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled for this project yet.";
    default:
      return "Google sign-in failed. Please try again.";
  }
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
