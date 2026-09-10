"use client";

import { useRouter } from "next/navigation";

/**
 * Small circular back arrow for the onboarding steps. Pass the destination
 * route via `to` so a user who makes a mistake can step back.
 *
 * The tap target is deliberately larger than the circle you can see. This sits
 * in the top-left corner of the screen, which is the hardest place on a tablet
 * to hit accurately — a thumb reaching that far lands wide, and a 40px circle
 * flush against the page padding missed often enough to feel broken. The
 * invisible ::before extends the target to ~68px, out to the screen edge on the
 * left, without moving the circle or taking room from what sits beside it.
 */
export function BackButton({ to, label = "Go back" }: { to: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(to)}
      aria-label={label}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors before:absolute before:-bottom-3 before:-left-4 before:-right-2 before:-top-3 before:content-[''] hover:bg-white/10 hover:text-white active:bg-white/15"
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
