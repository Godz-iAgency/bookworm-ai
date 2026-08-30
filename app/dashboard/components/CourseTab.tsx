"use client";

import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { CalendarClock } from "lucide-react";
import { useBookwormContext, type Book, type Course, type Day } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";
import { buildAmazonLink } from "@/lib/amazon";
import LessonReader from "./LessonReader";

export default function CourseTab({
  course,
  onDayCompleted,
}: {
  course: Course;
  /** Fired when a day is marked complete, so the dashboard can update the
   *  user's streak/badges. `finishedBook` is true when this was the 7th day. */
  onDayCompleted?: (dayLevel: number, finishedBook: boolean) => void;
}) {
  const { courses, setCourses } = useBookwormContext();
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [loadingDay, setLoadingDay] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<number | null>(null);
  const dayRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const topRef = useRef<HTMLDivElement>(null);

  // Pin Flashcards + Chat to whichever day the reader just opened. This is the
  // single source of truth those tabs follow — they stay on this day until the
  // reader opens a different one.
  const setActiveDay = (dayNumber: number) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, activeDayNumber: dayNumber } : c))
    );
  };

  // Days 2–7 have their full lesson generated on demand (the outline call only
  // produces Day 1). Open a day — fetching its lesson first if we don't have it.
  const openLesson = async (dayNumber: number) => {
    const day = course.days.find((d) => d.dayNumber === dayNumber);
    if (day?.lesson) {
      setActiveDay(dayNumber);
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
          // What the outline established about this book, so a day opened days
          // later is still written about the same book it planned.
          thesis: course.thesis ?? "",
          frameworks: course.frameworks ?? [],
          keyIdeas: day?.keyIdeas ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.lesson) throw new Error(data.error || "No lesson returned");

      // Cache the generated content into the course so we don't regenerate it,
      // and pin the flashcards/chat to this newly-opened day.
      setCourses((prev) =>
        prev.map((c) =>
          c.id === course.id
            ? {
                ...c,
                activeDayNumber: dayNumber,
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
    // This completion finishes the book if every other day is already done.
    // (Computed from the current course before we mutate state below.)
    const finishedBook = course.days.every((d) => d.dayNumber === dayLevel || d.isCompleted);

    // Apply the completion AND collapse the open lesson synchronously via
    // flushSync. Marking complete closes the expanded lesson (which can be
    // ~2000px tall); if we let React batch that collapse asynchronously, the
    // browser re-clamps the scroll position the moment the DOM shrinks — that's
    // the "jumps back to the top" bug. Flushing first means the layout is fully
    // settled before we run our own scrollIntoView, so ours is the last word.
    flushSync(() => {
      setCourses((prev) =>
        prev.map((c) => {
          if (c.id !== course.id) return c;
          const newDays = c.days.map((d) => {
            if (d.dayNumber === dayLevel) return { ...d, isCompleted: true };
            if (d.dayNumber === dayLevel + 1) return { ...d, isUnlocked: true };
            return d;
          });
          const allDone = newDays.every((d) => d.isCompleted);
          return { ...c, days: newDays, status: allDone ? ("completed" as const) : c.status };
        })
      );
      setOpenDay(null);
    });

    // Update the user's streak + badges (fire-and-forget; failures are logged
    // inside the helper and never block the reading flow).
    onDayCompleted?.(dayLevel, finishedBook);

    // Day 7 has no "next day" to unlock — scroll up to reveal the completion
    // banner. scrollIntoView (not window.scrollTo) because the dashboard's
    // scroll container is an inner div, not the window.
    if (dayLevel === 7) {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // Land the newly-unlocked next day at the top of the viewport so the reader
    // can tap "Read Lesson" right away.
    dayRefs.current[dayLevel + 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // An open lesson takes over the whole tab rather than expanding inside its
  // card. A 1000-word lesson boxed inside a centred card wasted most of the
  // screen on tablets and forced a cramped measure on phones; the reader owns
  // the full area and handles its own scrolling or paging.
  const readingDay = openDay !== null ? course.days.find((d) => d.dayNumber === openDay) : undefined;
  if (readingDay?.lesson) {
    const nextDay = course.days.find((d) => d.dayNumber === readingDay.dayNumber + 1);
    return (
      <LessonReader
        dayNumber={readingDay.dayNumber}
        dayTitle={readingDay.title}
        lesson={readingDay.lesson}
        intro={readingDay.dayNumber === 1 ? <Day1DeletionNote expiresAt={course.expiresAt} /> : undefined}
        outro={
          nextDay ? (
            <NextDayCard day={nextDay} />
          ) : (
            <LastDayCard book={course.book} />
          )
        }
        canComplete={readingDay.isUnlocked && !readingDay.isCompleted}
        onComplete={() => handleMarkComplete(readingDay.dayNumber)}
        onClose={() => setOpenDay(null)}
      />
    );
  }

  return (
    <div ref={topRef} className="w-full max-w-3xl mx-auto p-4 md:p-8 animate-in fade-in duration-500 pb-8">

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

      {course.days.every((d) => d.isCompleted) && <CourseCompleteBanner course={course} />}

      {/* Days Timeline */}
      <div className="space-y-4">
        {course.days.map((day) => {
          const isLocked = !day.isUnlocked;
          const isCurrent = day.isUnlocked && !day.isCompleted;

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

            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shown at the top of Day 1's lesson: names the exact date the course
// disappears, framed to encourage finishing all 7 days consistently. The 8-day
// window is the whole point of Bookworm — surfacing it early drives daily habit.
function Day1DeletionNote({ expiresAt }: { expiresAt: string }) {
  const date = new Date(expiresAt);
  if (isNaN(date.getTime())) return null;

  const formatted = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mb-6 flex items-start gap-4 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/5 p-4 shadow-[0_0_25px_rgba(0,212,255,0.18)]">
      <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#00D4FF]/25 to-[#FF006E]/25 shadow-[0_0_18px_rgba(0,212,255,0.45)]">
        <CalendarClock className="h-5 w-5 text-[#00D4FF]" strokeWidth={2} />
      </div>
      <p className="text-sm leading-relaxed text-white/75">
        This course is yours until{" "}
        <span className="font-bold text-[#00D4FF]">{formatted}</span>, then it
        clears to keep your shelf focused. Read one lesson a day. Finishing all
        7 before then is how the ideas really stick.
      </p>
    </div>
  );
}

/**
 * The last thing in a lesson: what tomorrow covers.
 *
 * The outline names and previews all seven days up front, and until now that
 * information only existed on the timeline behind the reader. Ending a lesson on
 * it turns seven separate lessons into one argument that is going somewhere,
 * and gives the reader a reason to come back tomorrow.
 */
function NextDayCard({ day }: { day: Day }) {
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">
        Tomorrow · Day {day.dayNumber}
      </p>
      <h4 className="mt-2 text-lg font-bold leading-tight text-white">{day.title}</h4>
      {day.previewText && (
        <p className="mt-2 text-sm leading-relaxed text-white/60">{day.previewText}</p>
      )}
    </div>
  );
}

/** Day 7 has no tomorrow, so it closes the book instead of pointing forward. */
function LastDayCard({ book }: { book: Book }) {
  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#00D4FF]">
        The last day
      </p>
      <h4 className="mt-2 text-lg font-bold leading-tight text-white">
        That&apos;s all seven days of {book.title}.
      </h4>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        Mark this one complete to finish the course.
      </p>
    </div>
  );
}

// Shown once all 7 days are completed — celebrates the finish and prompts the
// reader to buy the full book (Amazon affiliate) or start their next course.
function CourseCompleteBanner({ course }: { course: Course }) {
  return (
    <div
      className="relative mb-8 overflow-hidden rounded-2xl p-8 text-center animate-in fade-in slide-in-from-top-4 duration-500"
      style={{
        border: "1.5px solid transparent",
        background:
          "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
      }}
    >
      <div className="mb-4 text-5xl">🎉</div>
      <h3 className="mb-2 text-2xl md:text-3xl font-black tracking-tight">
        You finished{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E] italic">
          {course.book.title}
        </span>
        !
      </h3>
      <p className="mx-auto mb-6 max-w-md text-white/60">
        All 7 days done. Want to keep the full book on your shelf? Grab a copy and go deeper.
      </p>
      <div className="flex flex-col items-center gap-3 md:flex-row md:justify-center">
        <a
          href={buildAmazonLink(course.book.title, course.book.author)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="w-full md:w-auto rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-8 py-3 font-bold text-white transition-transform hover:scale-105"
        >
          Get the Book on Amazon →
        </a>
        <a
          href="/search"
          className="w-full md:w-auto rounded-xl border border-white/20 px-8 py-3 font-bold text-white/80 transition-all hover:border-white/40 hover:bg-white/5"
        >
          Start Your Next Course
        </a>
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

