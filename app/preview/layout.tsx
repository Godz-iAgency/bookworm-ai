"use client";

import type { ReactNode } from "react";
import { ReadingPrefsProvider } from "@/lib/ReadingPrefsContext";

// The free Day 1 opens in the real lesson reader, so it needs the reader's
// text size and layout, the same way the dashboard does.
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <ReadingPrefsProvider>{children}</ReadingPrefsProvider>;
}
