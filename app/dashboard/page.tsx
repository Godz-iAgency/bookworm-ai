"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBookwormContext, Course } from "@/lib/BookwormContext";

// Dashboard Tab Types
export type Tab = "course" | "chat" | "flashcards";

// Components
import CourseTab from "./components/CourseTab";
import ChatTab from "./components/ChatTab";
import FlashcardTab from "./components/FlashcardTab";

export default function DashboardPage() {
  const router = useRouter();
  const { courses, activeCourseId, setActiveCourseId } = useBookwormContext();
  const [activeTab, setActiveTab] = useState<Tab>("course");
  
  // Real-time recalculation of expirations (simulated checking logic)
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  
  useEffect(() => {
    setCurrentTime(new Date()); // Set on client mount to match SSR hydration
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // UI update every minute
    return () => clearInterval(timer);
  }, []);

  const MAX_COURSES = 3;
  const isLibraryFull = courses.length >= MAX_COURSES;
  
  const activeCourse = courses.find((c) => c.id === activeCourseId);

  // Expiration logic check
  const isCourseExpired = (expiresAt: string) => {
    if (!currentTime) return false;
    return new Date(expiresAt) < currentTime;
  };

  if (!activeCourse && courses.length > 0) {
    // Failsafe auto-select
    setActiveCourseId(courses[0].id);
  } else if (courses.length === 0) {
    // No courses at all -> back to start
    useEffect(() => { router.push("/search") }, [router])
    return null;
  }

  if (!currentTime) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-[#00D4FF] animate-spin" />
      </div>
    );
  }

  if (!activeCourse && courses.length > 0) {
    // Failsafe auto-select
    setActiveCourseId(courses[0].id);
  } else if (courses.length === 0) {
    // No courses at all -> back to start
    useEffect(() => { router.push("/search") }, [router])
    return null;
  }

  const renderTabContent = () => {
    if (!activeCourse) return null;
    
    // EXPIRED RULE: Expired courses cannot be accessed
    if (isCourseExpired(activeCourse.expiresAt)) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-[#FF006E] mb-2">Course Expired</h2>
          <p className="text-white/60 max-w-md">
            The 8-day sprint for this book has ended. To retain focus, you must delete this course to start a new one, or select another active course.
          </p>
        </div>
      );
    }

    return (
      <div className="h-full w-full relative">
        <div className={activeTab === "course" ? "h-full w-full block animate-in fade-in duration-300" : "hidden"}>
          <CourseTab course={activeCourse} />
        </div>
        <div className={activeTab === "chat" ? "h-full w-full block animate-in fade-in duration-300" : "hidden"}>
          <ChatTab course={activeCourse} />
        </div>
        <div className={activeTab === "flashcards" ? "h-full w-full block animate-in fade-in duration-300" : "hidden"}>
          <FlashcardTab course={activeCourse} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white flex flex-col font-sans">
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-screen w-full">
        {/* TOP BAR - My Library */}
        <div className="w-full bg-[#111] border-b border-white/10 p-4 shrink-0 flex items-center justify-between shadow-xl z-20">
          <div className="flex items-center gap-6">
            <Image src="/bookworm-logo.png" alt="Logo" width={100} height={26} className="hidden md:block opacity-80" />
            
            <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar snap-x">
              {courses.map((course) => {
                const expired = isCourseExpired(course.expiresAt);
                const isActive = course.id === activeCourseId;
                
                // Calculate days remaining (max 8)
                const msLeft = new Date(course.expiresAt).getTime() - currentTime!.getTime();
                const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
                const completedCount = course.days.filter(d => d.isCompleted).length;
                const progressPct = (completedCount / 7) * 100;

                return (
                  <button
                    key={course.id}
                    onClick={() => setActiveCourseId(course.id)}
                    className={`
                      snap-start shrink-0 flex items-center gap-3 w-64 p-2 rounded-xl border text-left transition-all relative overflow-hidden group
                      ${isActive ? 'bg-[#1a1a1a] border-cyan-500/50 shadow-[0_0_15px_rgba(0,212,255,0.15)]' : 'bg-transparent border-white/10 hover:bg-white/5'}
                      ${expired ? 'opacity-60 grayscale-[0.5]' : ''}
                    `}
                  >
                    {isActive && !expired && (
                      <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[#00D4FF] to-[#FF006E] [mask-image:linear-gradient(#fff_0_0)] [-webkit-mask-image:linear-gradient(#fff_0_0)] [-webkit-mask-composite:destination-out] [mask-composite:exclude]" />
                    )}
                    
                    <div className="w-10 h-14 relative shrink-0 rounded shadow-sm overflow-hidden bg-black">
                      <Image src={course.book.coverUrl} alt="Cover" fill className="object-cover" loading="lazy" unoptimized />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm truncate pr-2">{course.book.title}</p>
                        {expired ? (
                          <span className="text-[10px] font-bold text-[#FF006E] uppercase border border-[#FF006E]/30 bg-[#FF006E]/10 px-1.5 py-0.5 rounded shrink-0">Expired</span>
                        ) : (
                          <span className="text-[10px] font-bold text-[#00D4FF] uppercase border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-1.5 py-0.5 rounded shrink-0">{daysLeft}d left</span>
                        )}
                      </div>
                      
                      {/* Mini Progress Bar */}
                      <div className="h-1.5 w-full bg-black rounded-full overflow-hidden mt-2 border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
              
              {/* Add New / Locked Slot */}
              {isLibraryFull ? (
                <div className="shrink-0 flex items-center justify-center w-64 p-3 rounded-xl border border-white/5 bg-black/40 text-center relative group">
                  <p className="text-xs text-white/40">Complete or remove a course<br/>to start a new one</p>
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <span className="text-2xl">🔒</span>
                  </div>
                </div>
              ) : (
                <Link 
                  href="/search"
                  className="shrink-0 flex items-center justify-center gap-2 w-32 p-3 rounded-xl border border-dashed border-white/20 text-white/50 hover:text-white/90 hover:border-white/40 hover:bg-white/5 transition-all"
                >
                  <span className="text-xl">+</span> Add Course
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* MAIN LAYOUT */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT SIDEBAR - Navigation (Desktop) */}
          <div className="hidden md:flex flex-col w-64 border-r border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md p-4 pt-8 gap-2 shrink-0">
            <NavButton 
              icon="📅" 
              label="7-Day Course" 
              isActive={activeTab === "course"} 
              onClick={() => setActiveTab("course")} 
            />
            <NavButton 
              icon="🤖" 
              label="AI Chat" 
              isActive={activeTab === "chat"} 
              onClick={() => setActiveTab("chat")} 
            />
            <NavButton 
              icon="🗂️" 
              label="Flashcards" 
              isActive={activeTab === "flashcards"} 
              onClick={() => setActiveTab("flashcards")} 
            />
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto relative bg-transparent">
             {renderTabContent()}
          </div>
        </div>

        {/* BOTTOM NAV (Mobile) */}
        <div className="md:hidden w-full bg-[#111] border-t border-white/10 flex justify-around p-3 shrink-0 z-20">
            <MobileNavButton 
              icon="📅" 
              label="Course" 
              isActive={activeTab === "course"} 
              onClick={() => setActiveTab("course")} 
            />
            <MobileNavButton 
              icon="🤖" 
              label="Chat" 
              isActive={activeTab === "chat"} 
              onClick={() => setActiveTab("chat")} 
            />
            <MobileNavButton 
              icon="🗂️" 
              label="Learn" 
              isActive={activeTab === "flashcards"} 
              onClick={() => setActiveTab("flashcards")} 
            />
        </div>

      </div>
    </div>
  );
}

// Nav Helpers
function NavButton({ icon, label, isActive, onClick }: { icon: string, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-left
        ${isActive 
          ? 'bg-white/10 text-white border border-white/10 shadow-[inset_2px_0_0_0_#00D4FF]' 
          : 'text-white/60 hover:bg-white/5 hover:text-white'}
      `}
    >
      <span className="text-xl">{icon}</span>
      {label}
    </button>
  );
}

function MobileNavButton({ icon, label, isActive, onClick }: { icon: string, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1 w-16 transition-all
        ${isActive ? 'text-[#00D4FF]' : 'text-white/50 hover:text-white/80'}
      `}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {isActive && <div className="h-1 w-1 bg-[#00D4FF] rounded-full mt-1" />}
    </button>
  );
}
