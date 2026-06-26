"use client";

import { useRouter } from "next/navigation";

/**
 * Small circular back arrow for the onboarding steps. Pass the destination
 * route via `to` so a user who makes a mistake can step back.
 */
export function BackButton({ to, label = "Go back" }: { to: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(to)}
      aria-label={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  );
}
