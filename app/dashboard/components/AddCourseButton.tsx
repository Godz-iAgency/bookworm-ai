"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// A quick "start a new course" button for the Home + Course headers. Uses the
// app's card language — gradient border + glow, dark interior, gradient "+" —
// so it feels like part of the family (and matches the logo's colors). Routes
// to /search, or explains itself (same rule as the shelf's Add Course tile)
// when the library is at its open-book cap.
export default function AddCourseButton({
  isLibraryFull,
  maxOpenBooks,
}: {
  isLibraryFull: boolean;
  /** Shown in the "shelf is full" message so the cap isn't a mystery number. */
  maxOpenBooks?: number;
}) {
  const router = useRouter();
  const [showLimit, setShowLimit] = useState(false);

  // Auto-dismiss, so the message can't linger over the shelf.
  useEffect(() => {
    if (!showLimit) return;
    const t = setTimeout(() => setShowLimit(false), 4500);
    return () => clearTimeout(t);
  }, [showLimit]);

  // Reaching the cap must never render an inert element. A plain <div> here
  // looked identical to a broken button on a phone: there is no hover, so the
  // `title` tooltip that explained the lock could never actually be seen, and
  // tapping did nothing at all. It stays a real button and says why.
  if (isLibraryFull) {
    return (
      <div className="relative shrink-0">
        <button
          onClick={() => setShowLimit((o) => !o)}
          aria-label="Shelf full — tap to find out why"
          aria-expanded={showLimit}
          className={`flex h-11 w-11 items-center justify-center rounded-full border text-2xl font-bold leading-none transition-colors ${
            showLimit
              ? "border-[#FF006E]/60 bg-[#FF006E]/10 text-white/70"
              : "border-white/15 text-white/30 hover:border-white/30 hover:text-white/50"
          }`}
        >
          +
        </button>

        {showLimit && (
          <div
            role="status"
            onClick={() => setShowLimit(false)}
            className="absolute right-0 top-full z-30 mt-2 w-56 cursor-pointer rounded-xl border border-white/10 bg-[#1a1a1a] p-3 text-left shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <p className="text-xs font-bold text-white">
              Your shelf is full{maxOpenBooks ? ` (${maxOpenBooks} of ${maxOpenBooks})` : ""}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-white/60">
              Finish a book or remove one from your shelf to start a new course.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => router.push("/search")}
      aria-label="Add a new course"
      title="Add a new course"
      style={{
        border: "1.5px solid transparent",
        background:
          "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
        boxShadow: "0 0 15px rgba(0,212,255,0.25)",
      }}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110"
    >
      <span className="bg-gradient-to-br from-[#00D4FF] to-[#FF006E] bg-clip-text text-2xl font-bold leading-none text-transparent">
        +
      </span>
    </button>
  );
}
