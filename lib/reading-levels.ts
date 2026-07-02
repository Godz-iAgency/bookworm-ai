import { Sprout, BookOpen, Brain, type LucideIcon } from "lucide-react";

/**
 * The three reading levels, shared by onboarding (/reading-level) and the
 * Profile settings so they can never drift. Saved to the user's Firestore
 * profile as the lowercase `id`; drives the AI voice/persona each course is
 * written in (see lib/course-prompts.ts PERSONAS).
 */
export type ReadingLevelId = "explorer" | "scholar" | "architect";

export interface ReadingLevel {
  id: ReadingLevelId;
  label: string;
  Icon: LucideIcon;
  desc: string;
}

export const READING_LEVELS: ReadingLevel[] = [
  {
    id: "explorer",
    label: "Explorer",
    Icon: Sprout,
    desc: "Simple and fun. Written at a 3rd–5th grade level with everyday analogies.",
  },
  {
    id: "scholar",
    label: "Scholar",
    Icon: BookOpen,
    desc: "In the author's own voice. Balanced depth, real context, true to the book.",
  },
  {
    id: "architect",
    label: "Architect",
    Icon: Brain,
    desc: "Direct and action-first, Alex Hormozi style. Every idea ends with a step to take today.",
  },
];
