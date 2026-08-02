"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext, type Book } from "@/lib/BookwormContext";
import { generateCourseDays, buildCourse } from "@/lib/generate-course";
import {
  getBillingProfile,
  hasActiveAccess,
  canGenerate,
  getEffectivePlanId,
  getPlanLimits,
  isBillingEnabled,
} from "@/lib/billing";

export const GENERATION_STEPS = [
  "Reading the book's core ideas...",
  "Breaking it into 7 concepts...",
  "Writing your daily lessons...",
  "Building your flashcards...",
  "Almost ready...",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Everything that has to happen between "the reader has chosen a book and a
 * level" and "their course exists": the billing gate, the generation call, the
 * progress animation, and saving the result.
 *
 * This lives in a hook because two screens now start a course. Readers who set
 * their reading level during onboarding generate straight from /search, while
 * /reading-level remains for anyone who hasn't chosen a level yet or wants to
 * change it for this book. Both must apply the same plan limits and the same
 * soft gate, so neither owns the logic.
 */
export function useCourseGeneration() {
  const router = useRouter();
  const { user } = useAuth();
  const { courses, setCourses, setActiveCourseId, setCurrentReadingLevel } = useBookwormContext();

  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (book: Book, readingLevel: string) => {
      if (!user) return;
      setError(null);

      // Remember the level for this session (the soft gate reads it) and
      // persist it, but never block the reader on that write.
      setCurrentReadingLevel(readingLevel);
      updateDoc(doc(db, "users", user.uid), { readingLevel }).catch((e) =>
        console.error("Could not save reading level:", e)
      );

      // Billing checks only apply once Stripe is actually configured. Before
      // that the soft gate can't collect a card, so gating here would dead-end
      // every user — instead the app behaves exactly as it did pre-billing.
      const profile = isBillingEnabled() ? await getBillingProfile(user.uid) : null;

      if (isBillingEnabled()) {
        // Brand-new readers (no trial started, no plan yet) go through the soft
        // gate — it re-runs generation itself and collects the card before
        // saving the course. Only existing subscribers generate directly here.
        if (!profile || !hasActiveAccess(profile)) {
          router.push("/preview");
          return;
        }

        const gen = canGenerate(profile);
        if (!gen.allowed) {
          setError(
            gen.reason === "monthly_cap"
              ? "You've used all your book generations for this month."
              : "You've reached your plan's limit."
          );
          return;
        }

        const { maxOpenBooks } = getPlanLimits(getEffectivePlanId(profile));
        if (courses.length >= maxOpenBooks) {
          setError("Your library is full for your plan — delete a book to add a new one.");
          return;
        }
      }

      setIsGenerating(true);
      setGenStep(0);

      // Kick off the real generation and the step animation in parallel.
      const genTask = generateCourseDays(book.title, book.author, readingLevel);

      for (let i = 0; i < GENERATION_STEPS.length - 1; i++) {
        setGenStep(i);
        await sleep(1800);
      }
      setGenStep(GENERATION_STEPS.length - 1);

      const result = await genTask;

      if ("error" in result) {
        console.error("Generation error:", result.error);
        setError("We couldn't build your course right now. Please try again in a moment.");
        setIsGenerating(false);
        return;
      }

      const newCourse = buildCourse(book, readingLevel, result.days);
      setCourses([...courses, newCourse]);
      setActiveCourseId(newCourse.id);

      updateDoc(doc(db, "users", user.uid), {
        generationsThisMonth: increment(1),
      }).catch((e) => console.error("Could not update generation count:", e));

      router.push("/dashboard");
    },
    [user, courses, setCourses, setActiveCourseId, setCurrentReadingLevel, router]
  );

  return { start, isGenerating, genStep, error, setError };
}
