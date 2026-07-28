"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, getRedirectResult, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  resetPassword,
  logout,
  ensureUserDocument,
  friendlyAuthError,
} from "@/lib/firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  /**
   * Mobile Google sign-in leaves the app entirely and comes back, so its
   * outcome can only be collected here on reload — see the getRedirectResult
   * effect below. The auth pages read these to route and to show failures
   * that would otherwise be invisible.
   */
  redirectChecked: boolean;
  redirectIsNew: boolean;
  redirectError: string | null;
  signInWithGoogle: () => Promise<{ user: User | null; isNew: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<User>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectChecked, setRedirectChecked] = useState(false);
  const [redirectIsNew, setRedirectIsNew] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Collect the result of a mobile/Kindle signInWithRedirect. Without this the
  // redirect back from Google was never resolved: a failure (an unauthorised
  // domain, most often) surfaced nowhere, so tapping "Login with Google" just
  // returned the reader to the same screen with no explanation.
  useEffect(() => {
    let cancelled = false;
    getRedirectResult(auth)
      .then(async (cred) => {
        if (cancelled || !cred?.user) return;
        const isNew = await ensureUserDocument(cred.user);
        if (!cancelled) setRedirectIsNew(isNew);
      })
      .catch((err) => {
        console.error("Google redirect sign-in failed:", err);
        if (!cancelled) setRedirectError(friendlyAuthError(err));
      })
      .finally(() => {
        if (!cancelled) setRedirectChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Covers the mobile/Kindle redirect flow where the doc wasn't yet made.
        await ensureUserDocument(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        redirectChecked,
        redirectIsNew,
        redirectError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
