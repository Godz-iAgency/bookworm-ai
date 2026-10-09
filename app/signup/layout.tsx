import type { Metadata } from "next";

/** The signup page is a client component, so its title and description live here. */
export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a Bookworm AI account and turn any book into a 7-day course. Day 1 is free to read.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
