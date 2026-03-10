"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useBookwormContext, Course, Day } from "@/lib/BookwormContext";

const levels = [
  { id: "Beginner", icon: "🌱", desc: "New to this topic. Simple language, foundational ideas." },
  { id: "Intermediate", icon: "📖", desc: "Some familiarity. Balanced depth with clear context." },
  { id: "Advanced", icon: "🧠", desc: "Deep knowledge. Dense analysis, full nuance." },
  { id: "Deep Dive", icon: "🔬", desc: "Expert mode. Exhaustive breakdown, every principle." },
];

export default function ReadingLevelPage() {
  const router = useRouter();
  const { currentBook, setCurrentReadingLevel, courses, setCourses, setActiveCourseId } = useBookwormContext();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  const GENERATION_STEPS = [
    "Searching for book content...",
    "Analyzing core principles...",
    "Building your 7-day course...",
    "Creating your flashcards...",
    "Almost ready...",
  ];

  useEffect(() => {
    // If user somehow gets here without a book selected, redirect them back to search
    if (!currentBook) {
      router.push("/search");
    }
  }, [currentBook, router]);

  if (!currentBook) return null; // Avoid rendering flash before redirect

  const generateMockDays = (): Day[] => {
    return Array.from({ length: 7 }, (_, i) => ({
      dayNumber: i + 1,
      title: `Day ${i + 1} Principles from ${currentBook.title}`,
      previewText: "This is a placeholder for the AI-generated curriculum detailing the book's core concepts tailored to your chosen reading level.",
      isUnlocked: i === 0, // Day 1 is unlocked by default
      isCompleted: false,
    }));
  };

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const handleGenerateCourse = async () => {
    if (!selectedLevel) return;
    
    setIsGenerating(true);

    // Launch API generation in parallel
    const generateTask = fetch("/api/generate/course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: currentBook.title,
        author: currentBook.author,
        readingLevel: selectedLevel
      })
    })
    .then(res => res.json())
    .catch(err => {
      console.error(err);
      return null;
    });

    // Full-screen Animation Cycle (at least 7.5s visual buffer)
    for (let i = 0; i < GENERATION_STEPS.length; i++) {
      setGenerationStep(i);
      await sleep(1500);
    }

    const data = await generateTask;
    let generatedDays = [];
    
    if (data && data.days && Array.isArray(data.days)) {
      generatedDays = data.days.map((day: any) => ({
        dayNumber: day.dayNumber || 1,
        title: day.title || "Lesson",
        previewText: day.previewText || day.summary || "",
        isUnlocked: !!day.isUnlocked,
        isCompleted: false, // Ensure fresh state
      }));
    } else {
      // Fallback if API key missing or error
      generatedDays = generateMockDays();
    }

    setCurrentReadingLevel(selectedLevel);
    
    // Create new course scaffold
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 8);

    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      book: currentBook,
      readingLevel: selectedLevel,
      status: 'active',
      days: generatedDays,
      expiresAt: expirationDate.toISOString(),
    };

    setCourses([...courses, newCourse]);
    setActiveCourseId(newCourse.id);
    
    router.push("/dashboard");
  };

  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
        <style>{`
          @keyframes slide-gradient { 
            0% { background-position: 0% 50%; } 
            100% { background-position: 200% 50%; } 
          }
        `}</style>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
          <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={240} height={60} priority className="mb-16 drop-shadow-2xl light-glow" />
          
          {/* Animated gradient progress bar */}
          <div className="w-full h-3 bg-[#1a1a1a] rounded-full overflow-hidden mb-8 border border-white/5 shadow-inner">
             <div 
               className="h-full bg-gradient-to-r from-[#00D4FF] via-[#FF006E] to-[#00D4FF] rounded-full"
               style={{ 
                 backgroundSize: "200% auto",
                 animation: "slide-gradient 2s linear infinite",
                 width: `${((generationStep + 1) / GENERATION_STEPS.length) * 100}%`,
                 transition: "width 1.5s linear"
               }}
             />
          </div>

          {/* Rotating Status Message */}
          <h2 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E] animate-pulse h-10">
            {GENERATION_STEPS[generationStep]}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white flex flex-col items-center py-8 relative overflow-x-hidden">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />
      
      {/* Header */}
      <div className="w-full max-w-5xl px-6 flex justify-between items-center z-10 mb-8">
        <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={120} height={32} priority className="opacity-90" />
        
        {/* Memory Pill (Confirmed Book) */}
        <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20 shadow-lg backdrop-blur-sm">
          <div className="w-6 h-8 relative rounded overflow-hidden">
            <Image src={currentBook.coverUrl} alt="Cover" fill className="object-cover" loading="lazy" unoptimized />
          </div>
          <span className="text-sm font-semibold truncate max-w-[200px]">{currentBook.title}</span>
          <span className="text-sm text-white/50">by {currentBook.author.split(",")[0]}</span>
        </div>

        <div className="text-sm font-medium tracking-widest text-[#00D4FF] uppercase">
          Step 2 of 2
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-3xl px-4 flex flex-col items-center justify-center z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Mobile memory pill */}
        <div className="md:hidden flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20 shadow-lg backdrop-blur-sm mb-6">
          <span className="text-xs font-semibold truncate max-w-[150px]">{currentBook.title}</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center tracking-tight">
          How do you want to learn?
        </h1>
        <p className="text-lg text-white/60 mb-12 text-center max-w-lg">
          We'll customize your 7-day course based on your level.
        </p>

        {/* 2x2 Grid Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-12">
          {levels.map((level) => {
            const isSelected = selectedLevel === level.id;
            return (
              <div 
                key={level.id}
                onClick={() => setSelectedLevel(level.id)}
                className={`
                  cursor-pointer p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden group
                  ${isSelected ? 'bg-[#1a1a1a] border-transparent shadow-[0_0_20px_rgba(0,212,255,0.3)]' : 'bg-[#1a1a1a]/50 border-white/10 hover:border-white/30'}
                `}
              >
                {/* Gradient Border for Selected State */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-[#00D4FF] to-[#FF006E] [mask-image:linear-gradient(#fff_0_0)] [-webkit-mask-image:linear-gradient(#fff_0_0)] [-webkit-mask-composite:destination-out] [mask-composite:exclude]" />
                )}
                
                <div className="text-4xl mb-3">{level.icon}</div>
                <h3 className={`text-xl font-bold mb-2 ${isSelected ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E]' : 'text-white'}`}>
                  {level.id}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {level.desc}
                </p>
              </div>
            );
          })}
        </div>

        <Button
          onClick={handleGenerateCourse}
          disabled={!selectedLevel}
          className={`
            h-16 px-12 text-lg font-bold rounded-full transition-all duration-300
            ${selectedLevel 
              ? 'bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-105 shadow-lg shadow-pink-500/20' 
              : 'bg-white/10 text-white/40 cursor-not-allowed'}
          `}
        >
          Generate My Course →
        </Button>
      </div>

    </div>
  );
}
