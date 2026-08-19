"use client";

import { useState, useCallback, useRef } from "react";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  deleteField,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import type { MasteryBook } from "@/lib/mastery-library";

export interface SummarySection {
  title: string;
  /** Empty when this section has not been written yet, or failed. */
  prose: string;
}

/** One entry of the outline, kept so a half-finished summary can be resumed. */
export interface SummaryPlanItem {
  title: string;
  focus: string;
  keyIdeas: string[];
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
  /**
   * The outline. Index-aligned with `sections`, so a section that failed leaves
   * a hole we can come back and fill rather than a summary that silently ends
   * early. Absent on summaries generated before resuming existed.
   */
  plan?: SummaryPlanItem[];
  sections: SummarySection[];
  wordCount: number;
  createdAt: string;
  updatedAt?: string;
  /**
   * How far through the text the reader got, 0 to 1.
   *
   * A fraction, not a page number: pages are a function of screen size and text
   * size, so a saved "page 34" points somewhere else entirely on a phone at Huge
   * text. A fraction lands in the same place in the argument on any device.
   */
  progress?: number;
  /** Set the first time the reader reaches the last page. Never cleared. */
  completedAt?: string | null;
}

/**
 * Personal Development summaries live in their own collection, separate from
 * courses: no expiry, no plan quota, no flashcards or chat. A shelf the reader
 * keeps, and comes back to.
 */
export const summaryId = (pillarSlug: string, bookSlug: string) => `${pillarSlug}__${bookSlug}`;

const summaryRef = (uid: string, id: string) => doc(db, "users", uid, "summaries", id);

/**
 * A single small document listing what the reader has and how far through it
 * they are, so the category and book-list screens never load the text itself.
 *
 * At ten sections a summary is around 70KB. Reading all 150 to draw progress
 * bars would be ten megabytes of prose fetched to render a few percentages. The
 * index is a couple of KB for the whole library.
 *
 * It deliberately lives inside the `summaries` subcollection rather than a
 * collection of its own, so it is covered by the security rule that is already
 * deployed for summaries and needs no separate rules change.
 */
const INDEX_DOC_ID = "__index";

const indexRef = (uid: string) => summaryRef(uid, INDEX_DOC_ID);

export interface SummaryIndexEntry {
  pillarSlug: string;
  bookSlug: string;
  title: string;
  sectionsWritten: number;
  sectionsPlanned: number;
  wordCount: number;
  /** 0 to 1 through the text. */
  progress: number;
  complete: boolean;
  updatedAt: string;
}

export type SummaryIndex = Record<string, SummaryIndexEntry>;

function indexEntryFor(summary: MasterySummary): SummaryIndexEntry {
  return {
    pillarSlug: summary.pillarSlug,
    bookSlug: summary.bookSlug,
    title: summary.title,
    sectionsWritten: writtenSections(summary).length,
    sectionsPlanned: summary.plan?.length ?? summary.sections.length,
    wordCount: summary.wordCount,
    progress: summary.progress ?? 0,
    // Read to the end AND actually finished. A two-section stub that the reader
    // paged through is not a book they have read, and badging it Complete hides
    // the eight sections still waiting to be written.
    complete: !!summary.completedAt && isFullyWritten(summary),
    updatedAt: summary.updatedAt ?? summary.createdAt,
  };
}

/**
 * Merge one entry into the index. A nested merge write, so it touches only this
 * book's key and two summaries generated on two devices cannot clobber each
 * other's entries.
 */
async function writeIndexEntry(uid: string, summary: MasterySummary): Promise<void> {
  try {
    await setDoc(indexRef(uid), { entries: { [summary.id]: indexEntryFor(summary) } }, { merge: true });
  } catch (e) {
    // The index is a cache. Losing a write costs a stale progress bar, and must
    // never take down the generation that was actually the point.
    console.error("Could not update the summary index:", e);
  }
}

async function removeIndexEntry(uid: string, id: string): Promise<void> {
  try {
    await updateDoc(indexRef(uid), { [`entries.${id}`]: deleteField() });
  } catch (e) {
    console.error("Could not update the summary index:", e);
  }
}

/** Sections that actually have prose, in order. What the reader renders. */
export function writtenSections(summary: MasterySummary): SummarySection[] {
  return summary.sections.filter((s) => s.prose.trim().length > 0);
}

/** Indexes of planned sections still missing prose. What "continue" targets. */
export function missingSectionIndexes(summary: MasterySummary): number[] {
  const plan = summary.plan;
  if (!plan || plan.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < plan.length; i++) {
    if (!summary.sections[i]?.prose?.trim()) out.push(i);
  }
  return out;
}

/** The next section waiting to be written, or null when the book is finished. */
export function nextSectionIndex(summary: MasterySummary): number | null {
  const missing = missingSectionIndexes(summary);
  return missing.length > 0 ? missing[0] : null;
}

/** True only when every planned section has prose. Gates the Amazon offer. */
export function isFullyWritten(summary: MasterySummary): boolean {
  const planned = summary.plan?.length ?? summary.sections.length;
  return planned > 0 && writtenSections(summary).length >= planned;
}

function countWords(sections: SummarySection[]): number {
  return sections.reduce((n, s) => {
    const t = s.prose.trim();
    return t ? n + t.split(/\s+/).length : n;
  }, 0);
}

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
  /** Sections written so far, and how many the plan has in total. */
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [phase, setPhase] = useState<"idle" | "planning" | "writing" | "saving">("idle");
  /** Which section is being written right now, zero-based, for the wait screen. */
  const [writingIndex, setWritingIndex] = useState<number | null>(null);

  // Guards a second tap from starting a parallel run, which would have two
  // writers racing over the same sections array.
  const running = useRef(false);

  /**
   * Write exactly one section and save it.
   *
   * One section per user action, never a batch. Generating all ten in a loop was
   * the original design and it was wrong for two reasons that turned out to be
   * the same reason. Gemini's free tier allows twenty requests per day for the
   * whole project, so a ten-call burst either consumed half the day's budget in
   * one go or, once the budget was gone, failed eight of the ten and left a
   * two-section stub presented as a finished book. And a reader does not want
   * ten sections at once anyway: they want to read one, then decide.
   *
   * Making the section the unit of work fixes both. Each tap is one request, the
   * quota stretches across a real reading session, and a failure costs one
   * section that can simply be asked for again.
   */
  const writeSection = useCallback(
    async (uid: string, base: MasterySummary, index: number): Promise<MasterySummary> => {
      const plan = base.plan ?? [];
      const item = plan[index];
      if (!item) return base;

      setPhase("writing");
      setWritingIndex(index);
      setProgress({ done: writtenSections(base).length, total: plan.length });

      const res = await postJson("/api/mastery/section", {
        title: base.title,
        author: base.author,
        thesis: base.thesis,
        allTitles: plan.map((s) => s.title),
        index,
        sectionTitle: item.title,
        focus: item.focus,
        keyIdeas: item.keyIdeas,
      });

      if (typeof res?.prose !== "string" || !res.prose.trim()) {
        console.error(`Section ${index + 1} ("${item.title}") failed:`, res?.error);
        setError(
          `Section ${index + 1} didn't come back. This is usually the daily AI limit being used up, so it is worth trying again in a moment, or tomorrow.`
        );
        return base;
      }

      const sections = [...base.sections];
      sections[index] = { title: item.title, prose: res.prose };
      const next: MasterySummary = {
        ...base,
        sections,
        wordCount: countWords(sections),
        updatedAt: new Date().toISOString(),
      };

      setPhase("saving");
      await setDoc(summaryRef(uid, next.id), next);
      await writeIndexEntry(uid, next);
      setProgress({ done: writtenSections(next).length, total: plan.length });
      return next;
    },
    []
  );

  /**
   * Plan a book and write its first section only.
   *
   * Starting a book costs two requests, not ten: the outline, then section one.
   * Everything after that is the reader's choice, one section at a time.
   */
  const generate = useCallback(
    async (pillarSlug: string, book: MasteryBook): Promise<MasterySummary | null> => {
      if (!user || running.current) return null;
      running.current = true;

      setError(null);
      setIsGenerating(true);
      setPhase("planning");
      setProgress({ done: 0, total: 0 });
      setWritingIndex(null);

      try {
        const outline = await postJson("/api/mastery/outline", {
          title: book.title,
          author: book.author,
        });

        if (outline?.error || !Array.isArray(outline?.sections) || outline.sections.length === 0) {
          setError(outline?.error || "Could not plan this summary. Please try again.");
          return null;
        }

        const plan: SummaryPlanItem[] = outline.sections;
        const now = new Date().toISOString();

        // The shell is saved before a single section is written, so the plan
        // itself survives a failure and the reader is never left with a book
        // that has to be re-planned from nothing.
        const shell: MasterySummary = {
          id: summaryId(pillarSlug, book.slug),
          pillarSlug,
          bookSlug: book.slug,
          title: book.title,
          author: book.author,
          thesis: outline.thesis ?? "",
          frameworks: Array.isArray(outline.frameworks) ? outline.frameworks : [],
          confident: outline.confident !== false,
          plan,
          sections: plan.map((s) => ({ title: s.title, prose: "" })),
          wordCount: 0,
          createdAt: now,
          updatedAt: now,
          progress: 0,
          completedAt: null,
        };
        await setDoc(summaryRef(user.uid, shell.id), shell);
        await writeIndexEntry(user.uid, shell);

        return await writeSection(user.uid, shell, 0);
      } catch (e) {
        console.error("Summary generation failed:", e);
        setError("We couldn't build this summary right now. Please try again in a moment.");
        return null;
      } finally {
        running.current = false;
        setIsGenerating(false);
        setPhase("idle");
        setWritingIndex(null);
      }
    },
    [user, writeSection]
  );

  /**
   * Write the next section the reader has asked for: the lowest-numbered one
   * still missing, so a section that failed earlier is retried before the book
   * moves on and leaves a hole in the middle of the argument.
   */
  const generateNextSection = useCallback(
    async (existing: MasterySummary): Promise<MasterySummary | null> => {
      if (!user || running.current) return null;
      const index = nextSectionIndex(existing);
      if (index === null) return existing;
      running.current = true;

      setError(null);
      setIsGenerating(true);

      try {
        return await writeSection(user.uid, existing, index);
      } catch (e) {
        console.error("Section generation failed:", e);
        setError("We couldn't write that section right now. Please try again in a moment.");
        return null;
      } finally {
        running.current = false;
        setIsGenerating(false);
        setPhase("idle");
        setWritingIndex(null);
      }
    },
    [user, writeSection]
  );

  return {
    generate,
    generateNextSection,
    isGenerating,
    error,
    progress,
    phase,
    writingIndex,
    setError,
  };
}

export async function loadSummary(uid: string, id: string): Promise<MasterySummary | null> {
  const snap = await getDoc(summaryRef(uid, id));
  return snap.exists() ? (snap.data() as MasterySummary) : null;
}

/**
 * Every summary document, text included. Only used to rebuild the index; the
 * screens that just list books read the index instead.
 */
async function loadAllSummaries(uid: string): Promise<MasterySummary[]> {
  const snap = await getDocs(collection(db, "users", uid, "summaries"));
  return snap.docs
    .filter((d) => d.id !== INDEX_DOC_ID)
    .map((d) => d.data() as MasterySummary);
}

/**
 * The reader's library at a glance. Falls back to reading the summaries
 * themselves the first time, which backfills the index for anyone whose
 * summaries predate it.
 */
export async function loadSummaryIndex(uid: string): Promise<SummaryIndex> {
  const snap = await getDoc(indexRef(uid));
  const existing = snap.exists() ? (snap.data()?.entries as SummaryIndex | undefined) : undefined;
  if (existing) return existing;

  const all = await loadAllSummaries(uid);
  const entries: SummaryIndex = {};
  for (const s of all) entries[s.id] = indexEntryFor(s);
  try {
    await setDoc(indexRef(uid), { entries }, { merge: true });
  } catch (e) {
    console.error("Could not build the summary index:", e);
  }
  return entries;
}

export async function deleteSummary(uid: string, id: string): Promise<void> {
  await deleteDoc(summaryRef(uid, id));
  await removeIndexEntry(uid, id);
}

/**
 * Persist reading position. Called from the reader as the pages turn, so it is a
 * merge write of two fields rather than the whole 70KB document.
 *
 * `completedAt` is only ever set, never cleared: reaching the end of a book is a
 * thing that happened, and paging back to re-read a section should not undo it.
 */
export async function saveReadingProgress(
  uid: string,
  id: string,
  progress: number,
  complete: boolean
): Promise<void> {
  const clamped = Math.max(0, Math.min(1, progress));
  const patch: Record<string, unknown> = { progress: clamped };
  if (complete) patch.completedAt = new Date().toISOString();
  await setDoc(summaryRef(uid, id), patch, { merge: true });

  // Mirror into the index so the book list agrees with the reader without
  // having to open the book to find out.
  const indexPatch: Record<string, unknown> = { progress: clamped };
  if (complete) indexPatch.complete = true;
  try {
    await setDoc(indexRef(uid), { entries: { [id]: indexPatch } }, { merge: true });
  } catch (e) {
    console.error("Could not update the summary index:", e);
  }
}
