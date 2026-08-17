"use client";

import { useState, useCallback } from "react";
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import type { MasteryBook } from "@/lib/mastery-library";

export interface SummarySection {
  title: string;
  prose: string;
}

export interface MasterySummary {
  id: string;
  pillarSlug: string;
  bookSlug: string;
  title: string;
  author: string;
  thesis: string;
  frameworks: string[];
  /** False when the model flagged that it does not reliably know this book. */
  confident: boolean;
  sections: SummarySection[];
  wordCount: number;
  createdAt: string;
}

/**
 * Personal Development summaries live in their own collection, separate from
 * courses: no 8-day expiry, no plan quota, no flashcards or chat. A shelf the
 * reader keeps.
 */
export const summaryId = (pillarSlug: string, bookSlug: string) => `${pillarSlug}__${bookSlug}`;

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function useSummaryGeneration() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Sections finished so far, and how many there are in total. */
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [phase, setPhase] = useState<"idle" | "planning" | "writing" | "saving">("idle");

  const generate = useCallback(
    async (pillarSlug: string, book: MasteryBook): Promise<MasterySummary | null> => {
      if (!user) return null;

      setError(null);
      setIsGenerating(true);
      setPhase("planning");
      setProgress({ done: 0, total: 0 });

      try {
        const outline = await postJson("/api/mastery/outline", {
          title: book.title,
          author: book.author,
        });

        if (outline?.error || !Array.isArray(outline?.sections) || outline.sections.length === 0) {
          setError(outline?.error || "Could not plan this summary. Please try again.");
          return null;
        }

        const plan: { title: string; focus: string; keyIdeas: string[] }[] = outline.sections;
        const allTitles = plan.map((s) => s.title);

        setPhase("writing");
        setProgress({ done: 0, total: plan.length });

        // One section at a time, deliberately. Three at once was enough to
        // trip Gemini's burst limit, which cascaded into the Groq fallback
        // taking the same hit simultaneously and failing too - one rate
        // limited call turned into the whole summary coming back empty.
        // Sequential costs time; nothing else was actually reliable.
        const written: (string | null)[] = new Array(plan.length).fill(null);
        const failures: string[] = [];

        for (let i = 0; i < plan.length; i++) {
          const section = plan[i];
          const res = await postJson("/api/mastery/section", {
            title: book.title,
            author: book.author,
            thesis: outline.thesis,
            allTitles,
            index: i,
            sectionTitle: section.title,
            focus: section.focus,
            keyIdeas: section.keyIdeas,
          });
          // One failed section must not sink the whole summary; it is
          // recorded as missing and the reader can regenerate.
          if (typeof res?.prose === "string") {
            written[i] = res.prose;
          } else {
            console.error(`Section ${i + 1} ("${section.title}") failed:`, res?.error);
            failures.push(section.title);
          }
          setProgress({ done: i + 1, total: plan.length });
        }

        const sections: SummarySection[] = plan
          .map((s, i) => ({ title: s.title, prose: written[i] ?? "" }))
          .filter((s) => s.prose.trim().length > 0);

        // Some, but not all, sections failed: still worth saving, but the
        // reader should know it's incomplete rather than assume 5 was the
        // whole book.
        if (failures.length > 0 && sections.length > 0) {
          setError(
            `${failures.length} of ${plan.length} sections couldn't be generated (${failures.join(", ")}). Regenerate to try again for a complete summary.`
          );
        }

        if (sections.length === 0) {
          setError("The summary came back empty. Please try again.");
          return null;
        }

        const wordCount = sections.reduce((n, s) => n + s.prose.trim().split(/\s+/).length, 0);

        const summary: MasterySummary = {
          id: summaryId(pillarSlug, book.slug),
          pillarSlug,
          bookSlug: book.slug,
          title: book.title,
          author: book.author,
          thesis: outline.thesis ?? "",
          frameworks: Array.isArray(outline.frameworks) ? outline.frameworks : [],
          confident: outline.confident !== false,
          sections,
          wordCount,
          createdAt: new Date().toISOString(),
        };

        setPhase("saving");
        await setDoc(doc(db, "users", user.uid, "summaries", summary.id), summary);

        return summary;
      } catch (e: any) {
        console.error("Summary generation failed:", e);
        setError("We couldn't build this summary right now. Please try again in a moment.");
        return null;
      } finally {
        setIsGenerating(false);
        setPhase("idle");
      }
    },
    [user]
  );

  return { generate, isGenerating, error, progress, phase, setError };
}

export async function loadSummary(uid: string, id: string): Promise<MasterySummary | null> {
  const snap = await getDoc(doc(db, "users", uid, "summaries", id));
  return snap.exists() ? (snap.data() as MasterySummary) : null;
}

export async function loadAllSummaries(uid: string): Promise<MasterySummary[]> {
  const snap = await getDocs(collection(db, "users", uid, "summaries"));
  return snap.docs.map((d) => d.data() as MasterySummary);
}

export async function deleteSummary(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "summaries", id));
}
