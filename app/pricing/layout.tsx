import type { Metadata } from "next";
import { PLANS } from "@/lib/plans";

/**
 * The pricing page is a client component, so its title and description live
 * here. Built from lib/plans.ts so the prices a search result shows are always
 * the real ones.
 */
export const metadata: Metadata = {
  title: "Pricing",
  description: `Bookworm AI plans: ${PLANS.map((p) => `${p.name} ${p.price}`).join(", ")} a month. Day 1 of your first course is free to read.`,
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
