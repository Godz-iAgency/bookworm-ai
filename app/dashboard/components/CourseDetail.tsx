"use client";

import { useState } from "react";
import Image from "next/image";
import { BookOpen, Trash2, AlertTriangle } from "lucide-react";
import { Course } from "@/lib/BookwormContext";
import { getCountdown } from "@/lib/countdown";

interface CourseDetailProps {
  course: Course;
  currentTime: Date;
  onRead: () => void;
  onRemove: () => Promise<void> | void;
}

// Tap-in view for a single shelf course: cover, progress, countdown, and the
// (irreversible) option to remove it early to free a library slot.
export default function CourseDetail({ course, currentTime, onRead, onRemove }: CourseDetailProps) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const countdown = getCountdown(course.expiresAt, currentTime);
  const completedCount = course.days.filter((d) => d.isCompleted).length;
  const progressPct = (completedCount / 7) * 100;

  const handleRemove = async () => {
    setRemoving(true);
    await onRemove();
    // The parent unmounts this view on removal; no need to reset state.
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-24 md:pb-8">
      {/* Cover + identity */}
      <div className="flex flex-col items-center text-center">
        <div className="relative h-56 w-40 overflow-hidden rounded-xl bg-black shadow-2xl">
          <Image src={course.book.coverUrl} alt="Cover" fill className="object-cover" unoptimized />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight">{course.book.title}</h2>
        {course.book.author && <p className="mt-1 text-white/60">by {course.book.author}</p>}
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-[#1a1a1a] px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#00D4FF]">
            {course.readingLevel} Level
          </span>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${countdown.className}`}>
            {countdown.label}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#111] p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-white/50">Progress</span>
          <span className="text-sm font-bold text-white">{completedCount} / 7 days complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border border-white/5 bg-black">
          <div
            className="h-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Continue reading */}
      <button
        onClick={onRead}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-6 py-3.5 font-bold text-white transition-transform hover:scale-[1.02]"
      >
        <BookOpen className="h-5 w-5" strokeWidth={2} />
        Continue Reading
      </button>

      {/* Remove — irreversible, so it confirms inline first. */}
      <div className="mt-4">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF006E]/30 bg-[#FF006E]/5 px-6 py-3 font-bold text-[#FF006E] transition-all hover:bg-[#FF006E]/15"
          >
            <Trash2 className="h-5 w-5" strokeWidth={2} />
            Remove This Course
          </button>
        ) : (
          <div className="rounded-xl border border-[#FF006E]/40 bg-[#FF006E]/10 p-4">
            <div className="mb-3 flex items-start gap-2 text-left">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF006E]" strokeWidth={2} />
              <p className="text-sm text-white/80">
                This removes <span className="font-bold">{course.book.title}</span> and all your progress on it. This can&rsquo;t be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={removing}
                className="flex-1 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-white/80 transition-all hover:bg-white/5 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 rounded-lg bg-[#FF006E] px-4 py-2.5 font-bold text-white transition-all hover:bg-[#FF006E]/85 disabled:opacity-60"
              >
                {removing ? "Removing…" : "Yes, remove"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
