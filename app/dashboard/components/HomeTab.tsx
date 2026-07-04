"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Flame, Lock, MoreVertical } from "lucide-react";
import { Course } from "@/lib/BookwormContext";
import { BADGES } from "@/lib/badges";
import { getCountdown } from "@/lib/countdown";
import { currentStreak, localDateStr, type UserProgress } from "@/lib/firebase/progress";

interface HomeTabProps {
  courses: Course[];
  activeCourseId: string | null;
  currentTime: Date;
  isCourseExpired: (expiresAt: string) => boolean;
  isLibraryFull: boolean;
  onOpenCourse: (courseId: string) => void;
  onCourseDetails: (courseId: string) => void;
  progress: UserProgress;
}

// Particle burst for the earned-badge celebration — a wide, slow firework that
// erupts across the whole pill in the brand colors (+ gold for a July-4th pop).
// Precomputed so the render is cheap.
const BURST_PARTICLES = Array.from({ length: 30 }, (_, i) => {
  const angle = (i / 30) * Math.PI * 2 + (i % 2) * 0.35;
  const startR = 6 + (i % 5) * 6; // scattered start so the whole pill breaks apart
  const dist = 95 + (i % 4) * 30; // travels well past the pill edges
  return {
    sx: Math.round(Math.cos(angle) * startR),
    sy: Math.round(Math.sin(angle) * startR),
    dx: Math.round(Math.cos(angle) * dist),
    dy: Math.round(Math.sin(angle) * dist),
    size: 6 + (i % 3) * 3,
    color: ["#00D4FF", "#FF006E", "#ffffff", "#FFB020"][i % 4],
    delay: (i % 5) * 60,
  };
});

type BadgeToast = { badgeId: string; earned: boolean; phase: "in" | "burst" };

// The reader's shelf — every active course, at a glance, with the same
// escalating countdown used in the old top-bar strip. Tapping a card jumps
// straight into reading it.
export default function HomeTab({
  courses,
  activeCourseId,
  currentTime,
  isCourseExpired,
  isLibraryFull,
  onOpenCourse,
  onCourseDetails,
  progress,
}: HomeTabProps) {
  const streak = currentStreak(progress, currentTime);
  const today = localDateStr(currentTime);
  const readToday = progress.lastActivityDate === today;
  const earned = new Set(progress.badges);

  const [toast, setToast] = useState<BadgeToast | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  // Tap a badge to celebrate it (earned) or see how to earn it (locked).
  // Earned badges hold ~2s, then burst into particles before clearing.
  const tapBadge = (badgeId: string, isEarned: boolean) => {
    clearTimers();
    // Tapping the same badge again dismisses it.
    if (toast && toast.badgeId === badgeId) {
      setToast(null);
      return;
    }
    setToast({ badgeId, earned: isEarned, phase: "in" });
    if (isEarned) {
      // Hold the message ~2.2s to read, then a slow ~1.8s firework (3x the old
      // speed) as it dissipates — ~4s total before returning to the pills.
      timers.current.push(window.setTimeout(() => setToast((t) => (t ? { ...t, phase: "burst" } : null)), 2200));
      timers.current.push(window.setTimeout(() => setToast(null), 4000));
    } else {
      timers.current.push(window.setTimeout(() => setToast(null), 2800));
    }
  };

  const toastBadge = toast ? BADGES.find((b) => b.id === toast.badgeId) : null;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-24 md:pb-8">
      <div className="mb-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Your Shelf</h2>
        <p className="text-white/60 mt-2">Pick up where you left off, or start something new.</p>
      </div>

      {/* Streak + badges — gradient border + glow so it feels alive like the
          course cards, even at a 0 streak. */}
      <div
        className="mb-8 rounded-2xl p-5"
        style={{
          border: "1.5px solid transparent",
          background:
            "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
          boxShadow: "0 0 25px rgba(0,212,255,0.12)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all ${
              streak > 0
                ? "bg-gradient-to-br from-[#00D4FF]/25 to-[#FF006E]/25 shadow-[0_0_20px_rgba(255,0,110,0.4)]"
                : "bg-gradient-to-br from-[#00D4FF]/10 to-[#FF006E]/10"
            }`}
          >
            <Flame
              className={streak > 0 ? "h-7 w-7 text-[#FF006E]" : "h-7 w-7 text-white/40"}
              strokeWidth={2}
              fill={streak > 0 ? "currentColor" : "none"}
            />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-black leading-tight">
              <span className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent">{streak}</span>
              <span className="ml-1.5 text-base font-bold text-white/70">day{streak === 1 ? "" : "s"} streak</span>
            </div>
            <p className="text-sm text-white/50">
              {streak === 0
                ? "Complete a lesson today to start a streak."
                : readToday
                ? "You've read today — nicely done."
                : "Read a lesson today to keep it going."}
            </p>
          </div>
        </div>

        <style>{`
          @keyframes badge-burst {
            0%   { transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) scale(1); opacity: 1; }
            75%  { opacity: 1; }
            100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.35); opacity: 0; }
          }
        `}</style>

        {/* Tap-a-badge toast — celebration for earned, how-to-earn for locked.
            On the exit beat the earned pill dissipates while a slow firework
            erupts across it. */}
        {toast && toastBadge && (
          <div
            onClick={() => {
              clearTimers();
              setToast(null);
            }}
            className="relative mt-4 cursor-pointer animate-in fade-in zoom-in-95 duration-300"
          >
            {/* Pill content — dissipates (fade + expand + blur) during the burst. */}
            <div
              className={`flex flex-col items-center rounded-xl border border-white/10 bg-black/40 px-4 py-5 text-center transition-all ease-out ${
                toast.phase === "burst"
                  ? "scale-125 opacity-0 blur-[3px] duration-[1800ms]"
                  : "scale-100 opacity-100 blur-0 duration-300"
              }`}
            >
              <div
                className={`mb-2.5 flex h-14 w-14 items-center justify-center rounded-full ${
                  toast.earned
                    ? "bg-gradient-to-br from-[#00D4FF] to-[#FF006E] shadow-[0_0_22px_rgba(255,0,110,0.55)]"
                    : "bg-white/10"
                }`}
              >
                {toast.earned ? (
                  <toastBadge.Icon className="h-7 w-7 text-white" strokeWidth={2} />
                ) : (
                  <Lock className="h-6 w-6 text-white/50" strokeWidth={2} />
                )}
              </div>
              <p
                className={`text-lg font-black ${
                  toast.earned
                    ? "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-transparent"
                    : "text-white/80"
                }`}
              >
                {toastBadge.label}
              </p>
              <p className="mt-1 text-base font-medium text-white/75">
                {toast.earned ? toastBadge.message : toastBadge.hint}
              </p>
            </div>

            {/* Firework — erupts from the pill's center across its whole area. */}
            {toast.phase === "burst" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-0 w-0">
                  {BURST_PARTICLES.map((p, i) => (
                    <span
                      key={i}
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: p.size,
                        height: p.size,
                        borderRadius: "9999px",
                        background: p.color,
                        boxShadow: `0 0 6px ${p.color}`,
                        ["--sx" as string]: `${p.sx}px`,
                        ["--sy" as string]: `${p.sy}px`,
                        ["--dx" as string]: `${p.dx}px`,
                        ["--dy" as string]: `${p.dy}px`,
                        animation: `badge-burst 1.8s ease-out ${p.delay}ms forwards`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges — equal-width grid so every pill has matching margins. The odd
            5th badge spans the full row, keeping every row symmetric. Tap any
            badge to celebrate it (earned) or see how to earn it (locked). */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4">
          {BADGES.map((badge, i) => {
            const has = earned.has(badge.id);
            const isLast = i === BADGES.length - 1;
            const isActive = toast?.badgeId === badge.id;
            return (
              <button
                key={badge.id}
                onClick={() => tapBadge(badge.id, has)}
                className={`flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-all active:scale-95 ${
                  isLast ? "col-span-2" : ""
                } ${
                  has
                    ? `bg-[#00D4FF]/10 text-white shadow-[0_0_12px_rgba(0,212,255,0.2)] ${
                        isActive ? "border-[#00D4FF]" : "border-[#00D4FF]/40 hover:border-[#00D4FF]/70"
                      }`
                    : `bg-white/5 text-white/40 ${isActive ? "border-white/40" : "border-white/10 hover:border-white/25"}`
                }`}
              >
                {has ? (
                  <badge.Icon className="h-4 w-4 shrink-0 text-[#00D4FF]" strokeWidth={2} />
                ) : (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={2} />
                )}
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => {
          const expired = isCourseExpired(course.expiresAt);
          const isActive = course.id === activeCourseId;
          const countdown = getCountdown(course.expiresAt, currentTime);
          const completedCount = course.days.filter((d) => d.isCompleted).length;
          const progressPct = (completedCount / 7) * 100;

          return (
            <div
              key={course.id}
              className="relative"
              style={
                isActive && !expired
                  ? {
                      border: "1.5px solid transparent",
                      borderRadius: "1rem",
                      background:
                        "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
                    }
                  : undefined
              }
            >
              <button
                onClick={() => onOpenCourse(course.id)}
                className={`
                  flex w-full gap-4 rounded-2xl p-4 text-left transition-all
                  ${isActive ? "shadow-[0_0_20px_rgba(0,212,255,0.15)]" : "border border-white/10 hover:bg-white/5"}
                  ${expired ? "opacity-60 grayscale-[0.5]" : ""}
                `}
              >
                <div className="w-16 h-24 relative shrink-0 rounded-lg overflow-hidden bg-black shadow-md">
                  <Image src={course.book.coverUrl} alt="Cover" fill className="object-cover" loading="lazy" unoptimized />
                </div>

                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="font-bold text-base truncate pr-7">{course.book.title}</p>
                  <p className="text-xs text-white/50 uppercase tracking-wide mt-0.5">{course.readingLevel} Level</p>

                  <div className="mt-auto pt-3">
                    <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wide border px-1.5 py-0.5 rounded ${countdown.className}`}
                      >
                        {countdown.label}
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Course options — opens the detail/remove screen. Separate from
                  the card button (no nested buttons) and stops propagation. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCourseDetails(course.id);
                }}
                aria-label="Course options"
                className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-all hover:bg-white/10 hover:text-white"
              >
                <MoreVertical className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}

        {isLibraryFull ? (
          <div className="flex items-center justify-center rounded-2xl border border-white/5 bg-black/40 p-6 text-center">
            <p className="text-xs text-white/40">
              Complete or remove a course
              <br />
              to start a new one
            </p>
          </div>
        ) : (
          <Link
            href="/search"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 p-6 text-white/50 transition-all hover:border-white/40 hover:bg-white/5 hover:text-white/90"
          >
            <Plus className="w-6 h-6" strokeWidth={2} />
            <span className="text-sm font-bold">Add Course</span>
          </Link>
        )}
      </div>
    </div>
  );
}
