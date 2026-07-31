"use client";

import type { ReactNode } from "react";
import { ReadingPrefsProvider } from "@/lib/ReadingPrefsContext";

// Text size and scroll-vs-page live above the dashboard so the Profile screen
// (which sets them) and the lesson reader (which applies them) stay in sync
// without a round trip through Firestore on every change.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ReadingPrefsProvider>{children}</ReadingPrefsProvider>;
}
