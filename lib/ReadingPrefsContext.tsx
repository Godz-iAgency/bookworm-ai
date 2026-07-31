"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile, updateUserProfile } from "./firebase/profile";
import {
  coerceFontSize,
  coerceReadingMode,
  DEFAULT_FONT_SIZE,
  DEFAULT_READING_MODE,
  type ReadingFontSize,
  type ReadingMode,
} from "./reading-prefs";

interface ReadingPrefs {
  fontSize: ReadingFontSize;
  readingMode: ReadingMode;
  setFontSize: (size: ReadingFontSize) => void;
  setReadingMode: (mode: ReadingMode) => void;
}

const ReadingPrefsContext = createContext<ReadingPrefs>({
  fontSize: DEFAULT_FONT_SIZE,
  readingMode: DEFAULT_READING_MODE,
  setFontSize: () => {},
  setReadingMode: () => {},
});

// Firestore is the source of truth (so the setting follows the reader between
// devices), but it takes a round trip to answer. Mirroring to localStorage
// means a returning reader opens a lesson already at their own size instead of
// watching the text jump from the default a moment later.
const LS_KEY = "bookworm_reading_prefs";

export function ReadingPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [fontSize, setFontSizeState] = useState<ReadingFontSize>(DEFAULT_FONT_SIZE);
  const [readingMode, setReadingModeState] = useState<ReadingMode>(DEFAULT_READING_MODE);

  // Local mirror first. Read in an effect, never in a useState initializer —
  // the server renders the defaults, so touching localStorage during render
  // would produce a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      setFontSizeState(coerceFontSize(cached.fontSize));
      setReadingModeState(coerceReadingMode(cached.readingMode));
    } catch {
      // Corrupt or unavailable storage just means we start at the defaults.
    }
  }, []);

  // Then the authoritative copy from the reader's profile.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getUserProfile(user.uid)
      .then((profile) => {
        if (cancelled || !profile) return;
        if (profile.readingFontSize) setFontSizeState(coerceFontSize(profile.readingFontSize));
        if (profile.readingMode) setReadingModeState(coerceReadingMode(profile.readingMode));
      })
      .catch((e) => console.error("Failed to load reading preferences:", e));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const persist = useCallback(
    (patch: { readingFontSize?: string; readingMode?: string }) => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        const cached = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            fontSize: patch.readingFontSize ?? cached.fontSize,
            readingMode: patch.readingMode ?? cached.readingMode,
          })
        );
      } catch {
        // Non-fatal: the Firestore write below is what actually matters.
      }
      if (!user) return;
      updateUserProfile(user.uid, patch).catch((e) =>
        console.error("Failed to save reading preferences:", e)
      );
    },
    [user]
  );

  const setFontSize = useCallback(
    (size: ReadingFontSize) => {
      setFontSizeState(size);
      persist({ readingFontSize: size });
    },
    [persist]
  );

  const setReadingMode = useCallback(
    (mode: ReadingMode) => {
      setReadingModeState(mode);
      persist({ readingMode: mode });
    },
    [persist]
  );

  return (
    <ReadingPrefsContext.Provider value={{ fontSize, readingMode, setFontSize, setReadingMode }}>
      {children}
    </ReadingPrefsContext.Provider>
  );
}

export function useReadingPrefs() {
  return useContext(ReadingPrefsContext);
}
