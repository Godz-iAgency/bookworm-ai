/**
 * The three subscription tiers, named with a warm reading theme. Shown as a
 * readout on Profile now; the actual billing / upgrade flow lands with Stripe
 * (Phase 10). Everyone currently maps to the entry tier until billing exists.
 */
export interface Plan {
  id: "page_turner" | "well_read" | "book_club";
  name: string;
  tagline: string;
  price: string;
}

export const PLANS: Plan[] = [
  { id: "page_turner", name: "Page Turner", tagline: "Perfect for a page at a time", price: "$9.99" },
  { id: "well_read", name: "Well-Read", tagline: "For those who can't stop reading", price: "$19.99" },
  { id: "book_club", name: "Book Club", tagline: "Reading together, growing together", price: "$34.99" },
];

/** Map the stored `plan` field to a tier. Unknown / "free" → entry tier. */
export function planFromId(planField: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === planField) ?? PLANS[0];
}
