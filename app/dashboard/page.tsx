"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext } from "@/lib/BookwormContext";
import { CalendarDays, MessageCircle, Layers, Home, CircleUser, ChevronLeft, type LucideIcon } from "lucide-react";

// Dashboard Tab Types
export type Tab = "course" | "chat" | "flashcards";

// The top-level screen the dashboard is showing. "home" = the shelf (all
// courses), "reading" = the 3-tab experience for whichever course is active,
// "profile" = account/settings.
type View = "home" | "reading" | "profile";

// Components
import HomeTab from "./components/HomeTab";
import ProfileTab from "./components/ProfileTab";
import CourseTab from "./components/CourseTab";
import ChatTab from "./components/ChatTab";
import FlashcardTab from "./components/FlashcardTab";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { courses, activeCourseId, setActiveCourseId, coursesLoading } = useBookwormContext();
  const [view, setView] = useState<View>("home");
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

  // Fall back to the first course until the auto-select effect syncs activeCourseId.
  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0];

  // Expiration logic check
  const isCourseExpired = (expiresAt: string) => {
    if (!currentTime) return false;
    return new Date(expiresAt) < currentTime;
  };

  // A signed-in user with an empty library has no courses yet — send them to
  // create one. Gated on `user` so logging out (which also empties courses)
  // doesn't race this against ProfileTab's redirect to /login.
  useEffect(() => {
    if (!coursesLoading && user && courses.length === 0) {
      router.push("/search");
    }
  }, [coursesLoading, user, courses.length, router]);

  // Keep a valid course selected once loading is done.
  useEffect(() => {
    if (!coursesLoading && !activeCourseId && courses.length > 0) {
      setActiveCourseId(courses[0].id);
    }
  }, [coursesLoading, activeCourseId, courses, setActiveCourseId]);

  // Wait for auth + Firestore load (and the client clock) before deciding anything.
  if (coursesLoading || !currentTime) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-t-2 border-[#00D4FF] animate-spin" />
      </div>
    );
  }

  // Loaded but empty — the redirect effect above sends us to /search.
  if (courses.length === 0) return null;

  // Jump into the 3-tab reading experience for a given tab, on the currently active course.
  const goToTab = (tab: Tab) => {
    setActiveTab(tab);
    setView("reading");
  };

  const openCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setActiveTab("course");
    setView("reading");
  };

  const renderReadingContent = () => {
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

    // Chat + Flashcards follow the last lesson the reader opened
    // (course.activeDayNumber, set in CourseTab). They stay pinned there until
    // the reader opens a different day — including after the course is complete.
    // Fall back to the first unlocked/not-completed day only for a brand-new
    // course whose lesson hasn't been opened yet.
    const currentDay =
      activeCourse.days.find((d) => d.dayNumber === activeCourse.activeDayNumber) ??
      activeCourse.days.find((d) => d.isUnlocked && !d.isCompleted) ??
      [...activeCourse.days].reverse().find((d) => d.isUnlocked) ??
      activeCourse.days[0];

    return (
      <div className="h-full w-full relative">
        <div className={activeTab === "course" ? "h-full w-full block animate-in fade-in duration-300" : "hidden"}>
          <CourseTab course={activeCourse} />
        </div>
        <div className={activeTab === "chat" ? "h-full w-full block animate-in fade-in duration-300" : "hidden"}>
          <ChatTab course={activeCourse} day={currentDay} />
        </div>
        <div className={activeTab === "flashcards" ? "h-full w-full block animate-in fade-in duration-300" : "hidden"}>
          <FlashcardTab course={activeCourse} day={currentDay} />
        </div>
      </div>
    );
  };

  const renderMainContent = () => {
    if (view === "home") {
      return (
        <HomeTab
          courses={courses}
          activeCourseId={activeCourseId}
          currentTime={currentTime}
          isCourseExpired={isCourseExpired}
          isLibraryFull={isLibraryFull}
          onOpenCourse={openCourse}
        />
      );
    }
    if (view === "profile") {
      return <ProfileTab />;
    }
    return renderReadingContent();
  };

  // Inside a course: 3 icons, unchanged (Course / Chat / Flashcards).
  // Home or Profile: 5 icons (Home, Course, Chat, Flashcards, Profile) — tapping
  // Course/Chat/Flashcards from here jumps straight into reading the active course.
  const navItems: { icon: LucideIcon; label: string; isActive: boolean; onClick: () => void }[] =
    view === "reading"
      ? [
          { icon: CalendarDays, label: "Course", isActive: activeTab === "course", onClick: () => setActiveTab("course") },
          { icon: MessageCircle, label: "Chat", isActive: activeTab === "chat", onClick: () => setActiveTab("chat") },
          { icon: Layers, label: "Learn", isActive: activeTab === "flashcards", onClick: () => setActiveTab("flashcards") },
        ]
      : [
          { icon: Home, label: "Home", isActive: view === "home", onClick: () => setView("home") },
          { icon: CalendarDays, label: "Course", isActive: false, onClick: () => goToTab("course") },
          { icon: MessageCircle, label: "Chat", isActive: false, onClick: () => goToTab("chat") },
          { icon: Layers, label: "Learn", isActive: false, onClick: () => goToTab("flashcards") },
          { icon: CircleUser, label: "Profile", isActive: view === "profile", onClick: () => setView("profile") },
        ];

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white flex flex-col font-sans">
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-screen w-full">
        {/* TOP BAR */}
        {view === "reading" && activeCourse ? (
          <div className="w-full bg-[#111] border-b border-white/10 px-4 py-3 shrink-0 flex items-center gap-3 shadow-xl z-20">
            <button
              onClick={() => setView("home")}
              aria-label="Back to shelf"
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <div className="w-8 h-11 relative shrink-0 rounded overflow-hidden bg-black">
              <Image src={activeCourse.book.coverUrl} alt="Cover" fill className="object-cover" unoptimized />
            </div>
            <p className="font-bold text-sm truncate">{activeCourse.book.title}</p>
          </div>
        ) : (
          <div className="w-full bg-[#111] border-b border-white/10 p-4 shrink-0 flex items-center shadow-xl z-20">
            <Image src="/bookworm-logo.png" alt="Logo" width={100} height={26} className="opacity-80" />
          </div>
        )}

        {/* MAIN LAYOUT */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR - Navigation (Desktop) */}
          <div className="hidden md:flex flex-col w-64 border-r border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md p-4 pt-8 gap-2 shrink-0">
            {navItems.map((item) => (
              <NavButton key={item.label} icon={item.icon} label={item.label} isActive={item.isActive} onClick={item.onClick} />
            ))}
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto relative bg-transparent">
            {renderMainContent()}
          </div>
        </div>

        {/* BOTTOM NAV (Mobile) */}
        <div className="md:hidden w-full bg-[#111] border-t border-white/10 flex justify-around p-3 shrink-0 z-20">
          {navItems.map((item) => (
            <MobileNavButton key={item.label} icon={item.icon} label={item.label} isActive={item.isActive} onClick={item.onClick} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Nav Helpers
function NavButton({ icon: Icon, label, isActive, onClick }: { icon: LucideIcon, label: string, isActive: boolean, onClick: () => void }) {
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
      <Icon className="w-5 h-5" strokeWidth={2} />
      {label}
    </button>
  );
}

function MobileNavButton({ icon: Icon, label, isActive, onClick }: { icon: LucideIcon, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1 w-16 transition-all
        ${isActive ? 'text-[#00D4FF]' : 'text-white/50 hover:text-white/80'}
      `}
    >
      <Icon className="w-6 h-6" strokeWidth={2} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      {isActive && <div className="h-1 w-1 bg-[#00D4FF] rounded-full mt-1" />}
    </button>
  );
}
