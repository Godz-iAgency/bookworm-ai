"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Course } from "@/lib/BookwormContext";

interface HomeTabProps {
  courses: Course[];
  activeCourseId: string | null;
  currentTime: Date;
  isCourseExpired: (expiresAt: string) => boolean;
  isLibraryFull: boolean;
  onOpenCourse: (courseId: string) => void;
}

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
}: HomeTabProps) {
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-24 md:pb-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Your Shelf</h2>
        <p className="text-white/60 mt-2">Pick up where you left off, or start something new.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => {
          const expired = isCourseExpired(course.expiresAt);
          const isActive = course.id === activeCourseId;

          const msLeft = new Date(course.expiresAt).getTime() - currentTime.getTime();
          const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
          const completedCount = course.days.filter((d) => d.isCompleted).length;
          const progressPct = (completedCount / 7) * 100;

          // Same escalating urgency tiers as before. Copy says "disappears", never "delete".
          let countdown: { label: string; className: string };
          if (expired) {
            countdown = { label: "Expired", className: "text-[#FF006E] border-[#FF006E]/30 bg-[#FF006E]/10" };
          } else if (daysLeft <= 1) {
            countdown = {
              label: "Disappears today",
              className:
                "text-[#FF006E] border-[#FF006E]/50 bg-[#FF006E]/15 animate-pulse shadow-[0_0_12px_rgba(255,0,110,0.45)]",
            };
          } else if (daysLeft <= 3) {
            countdown = { label: `${daysLeft} days left`, className: "text-[#FFB020] border-[#FFB020]/40 bg-[#FFB020]/10" };
          } else {
            countdown = { label: `${daysLeft} days left`, className: "text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10" };
          }

          return (
            <button
              key={course.id}
              onClick={() => onOpenCourse(course.id)}
              style={
                isActive && !expired
                  ? {
                      border: "1.5px solid transparent",
                      background:
                        "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
                    }
                  : undefined
              }
              className={`
                flex gap-4 rounded-2xl border p-4 text-left transition-all
                ${isActive ? "shadow-[0_0_20px_rgba(0,212,255,0.15)]" : "border-white/10 hover:bg-white/5"}
                ${expired ? "opacity-60 grayscale-[0.5]" : ""}
              `}
            >
              <div className="w-16 h-24 relative shrink-0 rounded-lg overflow-hidden bg-black shadow-md">
                <Image src={course.book.coverUrl} alt="Cover" fill className="object-cover" loading="lazy" unoptimized />
              </div>

              <div className="flex-1 min-w-0 flex flex-col">
                <p className="font-bold text-base truncate">{course.book.title}</p>
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
