import { Footprints, Milestone, Trophy, Library, Flame, type LucideIcon } from "lucide-react";

/**
 * Milestone badges shown on the Home shelf. Earned once and kept permanently
 * (stored as ids on the user's Firestore doc), so they persist even after the
 * book that earned them expires and is cleared.
 */
export interface BadgeDef {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Shown on tap for a LOCKED badge — how to earn it. */
  hint: string;
  /** Shown on tap for an EARNED badge — a 7-word congratulation. */
  message: string;
}

export const BADGES: BadgeDef[] = [
  {
    id: "first_steps",
    label: "First Steps",
    Icon: Footprints,
    hint: "Finish Day 1 of any book",
    message: "You took the first step!",
  },
  {
    id: "halfway",
    label: "Halfway There",
    Icon: Milestone,
    hint: "Reach Day 4 of any book",
    message: "Halfway there, keep it going!",
  },
  {
    id: "book_finished",
    label: "Book Finished",
    Icon: Trophy,
    hint: "Finish all 7 days of a book",
    message: "You finished a whole book!",
  },
  {
    id: "bookworm",
    label: "Bookworm",
    Icon: Library,
    hint: "Finish 3 books",
    message: "Three books done, true bookworm!",
  },
  {
    id: "on_fire",
    label: "On Fire",
    Icon: Flame,
    hint: "Hit a 3-day streak",
    message: "Three days strong, streak blazing!",
  },
];
