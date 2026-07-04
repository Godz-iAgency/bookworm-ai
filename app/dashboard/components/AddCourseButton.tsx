"use client";

import { useRouter } from "next/navigation";

// A quick "start a new course" button for the Home + Course headers. Uses the
// app's card language — gradient border + glow, dark interior, gradient "+" —
// so it feels like part of the family (and matches the logo's colors). Routes
// to /search, or locks (same rule as the shelf's Add Course tile) when the
// library is at its 3-course cap.
export default function AddCourseButton({ isLibraryFull }: { isLibraryFull: boolean }) {
  const router = useRouter();

  if (isLibraryFull) {
    return (
      <div
        aria-label="Library full — complete or remove a course first"
        title="Complete or remove a course to add a new one"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl font-bold leading-none text-white/25"
      >
        +
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
