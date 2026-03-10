"use client";

import { useBookwormContext, Course } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";

export default function CourseTab({ course }: { course: Course }) {
  const { courses, setCourses } = useBookwormContext();

  const handleMarkComplete = (dayLevel: number) => {
    // Progressive unlock logic: mark day complete, unlock next day
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

          return (
            <div 
              key={day.dayNumber}
              className={`
                relative rounded-2xl p-6 transition-all duration-300 border overflow-hidden group
                ${day.isCompleted ? 'bg-[#111] border-[#00D4FF]/30 opacity-80' : ''}
                ${isCurrent ? 'bg-[#1a1a1a] border-white/20 shadow-lg' : ''}
                ${isLocked ? 'bg-black/40 border-white/5 opacity-50 backdrop-blur-sm' : ''}
              `}
            >
              {/* Active Gradient Border */}
              {isCurrent && (
                <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-[#00D4FF] to-[#FF006E] [mask-image:linear-gradient(#fff_0_0)] [-webkit-mask-image:linear-gradient(#fff_0_0)] [-webkit-mask-composite:destination-out] [mask-composite:exclude]" />
              )}
              
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
                <div className="shrink-0 flex items-center md:items-start justify-between md:flex-col md:w-40 gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                  {!isLocked && (
                    <div className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
                      ⏱️ ~15 min
                    </div>
                  )}
                  
                  {isCurrent && (
                    <Button 
                      onClick={() => handleMarkComplete(day.dayNumber)}
                      className="w-full bg-white text-black hover:bg-gray-200 font-bold transition-all hover:scale-105"
                    >
                      Mark Complete
                    </Button>
                  )}

                  {day.isCompleted && (
                    <div className="flex items-center gap-2 text-[#00D4FF] font-bold">
                      <span className="text-xl">✓</span> Completed
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
