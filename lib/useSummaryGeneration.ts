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

/**
 * How many section calls run at once. Sequential would put a 9 section
 * summary somewhere north of two minutes; unbounded parallel invites rate
 * limiting from the model provider. Three keeps the whole thing to roughly
 * the length of a course generation.
 */
const CONCURRENCY = 3;

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

        // Fixed-size slots pulling from a shared cursor, so a fast section
        // never sits waiting on a slow one in the same batch.
        const written: (string | null)[] = new Array(plan.length).fill(null);
        let cursor = 0;
        let completed = 0;

        const worker = async () => {
          while (true) {
            const i = cursor++;
            if (i >= plan.length) return;
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
            written[i] = typeof res?.prose === "string" ? res.prose : null;
            completed++;
            setProgress({ done: completed, total: plan.length });
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, plan.length) }, () => worker())
        );

        const sections: SummarySection[] = plan
          .map((s, i) => ({ title: s.title, prose: written[i] ?? "" }))
          .filter((s) => s.prose.trim().length > 0);

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
