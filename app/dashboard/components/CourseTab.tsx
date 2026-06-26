"use client";

import { useState, useEffect, useRef } from "react";
import { useBookwormContext, Course } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";

export default function CourseTab({ course }: { course: Course }) {
  const { courses, setCourses } = useBookwormContext();
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [loadingDay, setLoadingDay] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<number | null>(null);
  const dayRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Days 2–7 have their full lesson generated on demand (the outline call only
  // produces Day 1). Open a day — fetching its lesson first if we don't have it.
  const openLesson = async (dayNumber: number) => {
    if (openDay === dayNumber) {
      setOpenDay(null);
      return;
    }

    const day = course.days.find((d) => d.dayNumber === dayNumber);
    if (day?.lesson) {
      setOpenDay(dayNumber);
      return;
    }

    setLoadingDay(dayNumber);
    setLoadError(null);
    try {
      const res = await fetch("/api/course/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.book.title,
          author: course.book.author,
          readingLevel: course.readingLevel,
          dayNumber,
          dayTitle: day?.title ?? `Day ${dayNumber}`,
          allTitles: course.days.map((d) => d.title),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.lesson) throw new Error(data.error || "No lesson returned");

      // Cache the generated content into the course so we don't regenerate it.
      setCourses(
        courses.map((c) =>
          c.id === course.id
            ? {
                ...c,
                days: c.days.map((d) =>
                  d.dayNumber === dayNumber
                    ? { ...d, lesson: data.lesson, flashcards: data.flashcards, chatSeed: data.chatSeed }
                    : d
                ),
              }
            : c
        )
      );
      setOpenDay(dayNumber);
    } catch (err) {
      console.error("Lesson load failed:", err);
      setLoadError(dayNumber);
    } finally {
      setLoadingDay(null);
    }
  };

  const handleMarkComplete = (dayLevel: number) => {
    const updatedCourses = courses.map(c => {
      if (c.id === course.id) {
        const newDays = c.days.map(d => {
          if (d.dayNumber === dayLevel) {
            return { ...d, isCompleted: true };
          }
          if (d.dayNumber === dayLevel + 1) {
            return { ...d, isUnlocked: true };
          }
          return d;
        });
        return { ...c, days: newDays };
      }
      return c;
    });

    setCourses(updatedCourses);
    setOpenDay(null);

    // Scroll to the next day after React re-renders
    const nextDay = dayLevel + 1;
    setTimeout(() => {
      dayRefs.current[nextDay]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-24 md:pb-8">
      
      {/* Course Header */}
      <div className="mb-10 text-center animate-in slide-in-from-top-4">
        <div className="inline-block bg-[#1a1a1a] border border-white/10 rounded-full px-4 py-1.5 mb-4 text-[#00D4FF] text-xs font-bold tracking-widest uppercase">
          {course.readingLevel} Level
        </div>
        <h2 className="text-3xl md:text-5xl font-bold mb-3 tracking-tight">
          7 Days of <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E] italic">{course.book.title}</span>
        </h2>
        <p className="text-white/60">Unlock the core principles day by day.</p>
      </div>

      {/* Days Timeline */}
      <div className="space-y-4">
        {course.days.map((day) => {
          const isLocked = !day.isUnlocked;
          const isCurrent = day.isUnlocked && !day.isCompleted;

          const isOpen = openDay === day.dayNumber;

          // Active day gets a true gradient border (padding-box keeps the
          // interior dark; border-box paints the gradient only on the edge).
          const cardStyle = isCurrent
            ? {
                border: "1.5px solid transparent",
                background:
                  "linear-gradient(#1a1a1a,#1a1a1a) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
              }
            : undefined;

          return (
            <div
              key={day.dayNumber}
              ref={(el) => { dayRefs.current[day.dayNumber] = el; }}
              style={cardStyle}
              className={`
                relative rounded-2xl p-6 transition-all duration-300 border overflow-hidden group
                ${day.isCompleted ? 'bg-[#111] border-[#00D4FF]/30' : ''}
                ${isCurrent ? 'shadow-lg' : ''}
                ${isLocked ? 'bg-black/40 border-white/5 opacity-50 backdrop-blur-sm' : ''}
              `}
            >

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                {/* Left side content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`
                      text-xs font-bold px-2 py-1 rounded 
                      ${day.isCompleted ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : ''}
                      ${isCurrent ? 'bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white' : ''}
                      ${isLocked ? 'bg-white/10 text-white/40' : ''}
                    `}>
                      DAY {day.dayNumber}
                    </span>
                    <h3 className={`text-xl font-bold ${isLocked ? 'text-white/40' : 'text-white'}`}>
                      {day.title}
                    </h3>
                    {day.isCompleted && (
                      <span className="flex items-center gap-1 rounded-full bg-[#00D4FF]/15 px-2 py-0.5 text-xs font-bold text-[#00D4FF]">
                        ✓ Done
                      </span>
                    )}
                  </div>

                  {!isLocked && (
                    <p className="text-white/70 leading-relaxed mt-3">
                      {day.previewText}
                    </p>
                  )}
                  
                  {isLocked && (
                    <p className="text-white/30 italic flex items-center gap-2 mt-2">
                      <span>🔒</span> Complete previous day to unlock
                    </p>
                  )}
                </div>

                {/* Right side interactions */}
                <div className="shrink-0 flex flex-wrap items-center gap-3 md:flex-col md:items-stretch md:w-44 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  {!isLocked && (
                    <div className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
                      ⏱️ ~15 min
                    </div>
                  )}

                  {!isLocked && (
                    <Button
                      onClick={() => openLesson(day.dayNumber)}
                      disabled={loadingDay === day.dayNumber}
                      className={`flex-1 min-w-[130px] md:w-full font-bold transition-all hover:scale-105 disabled:opacity-70 ${
                        day.isCompleted
                          ? "border border-[#00D4FF]/40 bg-transparent text-[#00D4FF] hover:bg-[#00D4FF]/10"
                          : "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white"
                      }`}
                    >
                      {loadingDay === day.dayNumber
                        ? "Opening…"
                        : isOpen
                        ? "Close"
                        : day.isCompleted
                        ? "Review"
                        : "Read Lesson"}
                    </Button>
                  )}

                  {isCurrent && (
                    <Button
                      onClick={() => handleMarkComplete(day.dayNumber)}
                      className="flex-1 min-w-[130px] md:w-full bg-white text-black hover:bg-gray-200 font-bold transition-all hover:scale-105"
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              </div>

              {/* Animated loader while this day's lesson is being written */}
              {loadingDay === day.dayNumber && <DayLoader dayNumber={day.dayNumber} />}

              {/* Inline error if generation failed */}
              {loadError === day.dayNumber && (
                <p className="relative z-10 mt-4 text-sm text-[#FF006E]">
                  Couldn&apos;t generate this lesson. Please tap Read Lesson to try again.
                </p>
              )}

              {/* Expanded lesson reader */}
              {isOpen && !isLocked && (
                <div className="relative z-10 mt-6 border-t border-white/10 pt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  {day.lesson ? (
                    <article className="whitespace-pre-wrap text-[15px] leading-7 text-white/85">
                      {day.lesson}
                    </article>
                  ) : (
                    <p className="text-white/50 italic">No lesson content available for this day.</p>
                  )}

                  {isCurrent && (
                    <Button
                      onClick={() => handleMarkComplete(day.dayNumber)}
                      className="mt-6 w-full bg-white text-black hover:bg-gray-200 font-bold transition-all hover:scale-105 md:w-auto md:px-10"
                    >
                      ✓ Mark Day {day.dayNumber} Complete
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Friendly animated loader shown inline while a day's lesson is generated.
// The cycling messages + shimmer make the ~10s wait feel purposeful.
function DayLoader({ dayNumber }: { dayNumber: number }) {
  const messages = [
    "Opening the book…",
    `Day ${dayNumber} coming up…`,
    "Gathering the key ideas…",
    "Almost ready…",
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % messages.length), 1600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative z-10 mt-6 flex flex-col items-center border-t border-white/10 pt-8 pb-4 text-center animate-in fade-in duration-300">
      <style>{`
        @keyframes dl-slide { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes dl-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
      `}</style>

      <div className="mb-5 text-5xl" style={{ animation: "dl-float 1.6s ease-in-out infinite" }}>
        📖
      </div>

      <div className="mb-5 h-2.5 w-full max-w-xs overflow-hidden rounded-full border border-white/5 bg-[#0a0a0a]">
        <div
          className="h-full w-full rounded-full bg-gradient-to-r from-[#00D4FF] via-[#FF006E] to-[#00D4FF]"
          style={{ backgroundSize: "200% auto", animation: "dl-slide 1.5s linear infinite" }}
        />
      </div>

      <p className="animate-pulse bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-lg font-bold text-transparent">
        {messages[i]}
      </p>
    </div>
  );
}
