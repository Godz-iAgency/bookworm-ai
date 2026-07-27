/**
 * The three subscription tiers, named with a warm reading theme. Shown as a
 * readout on Profile and used to size Stripe billing + generation quotas +
 * the concurrent-open-book cap enforced on the dashboard.
 *
 * The 7-day free trial only ever runs on `page_turner` — Well-Read and Book
 * Club are paid-upgrade-only, never trial tiers (see lib/billing.ts).
 */
export interface Plan {
  id: "page_turner" | "well_read" | "book_club";
  name: string;
  tagline: string;
  price: string;
  /** Generations allowed per calendar month once the plan is fully paid (not during trial). */
  monthlyGenerations: number;
  /** Max concurrently open (un-deleted) books at once. */
  maxOpenBooks: number;
  /** Book Club only: max people sharing one subscription, owner included. */
  maxMembers?: number;
}

export const PLANS: Plan[] = [
  {
    id: "page_turner",
    name: "Page Turner",
    tagline: "Perfect for a page at a time",
    price: "$9.99",
    monthlyGenerations: 10,
    maxOpenBooks: 3,
  },
  {
    id: "well_read",
    name: "Well-Read",
    tagline: "For those who can't stop reading",
    price: "$19.99",
    monthlyGenerations: 25,
    maxOpenBooks: 5,
  },
  {
    id: "book_club",
    name: "Book Club",
    tagline: "Reading together, growing together",
    price: "$34.99",
    monthlyGenerations: 10,
    maxOpenBooks: 3,
    maxMembers: 4,
  },
];

/** Map the stored `plan` field to a tier. Unknown / "free" → entry tier. */
export function planFromId(planField: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === planField) ?? PLANS[0];
}
