import { ReadingPrefsProvider } from "@/lib/ReadingPrefsContext";

// Mastery summaries are long reads, so they need the same font-size and
// reading-mode preferences the course reader uses. Those live in a provider
// that /dashboard mounts for its own routes; this mounts it for these.
export default function MasteryLayout({ children }: { children: React.ReactNode }) {
  return <ReadingPrefsProvider>{children}</ReadingPrefsProvider>;
}
