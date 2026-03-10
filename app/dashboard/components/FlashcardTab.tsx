"use client";

import { useState } from "react";
import { Course } from "@/lib/BookwormContext";
import { Button } from "@/components/ui/button";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  mastered: boolean;
}

export default function FlashcardTab({ course }: { course: Course }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const generateCards = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: course.book.title,
          author: course.book.author,
          readingLevel: course.readingLevel
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.cards) {
        const generatedCards = data.cards.map((card: any, index: number) => ({
          id: index.toString(),
          front: card.front || card.question,
          back: card.back || card.answer,
          mastered: false
        }));
        setCards(generatedCards);
      } else {
        throw new Error(data.error || "Failed to generate cards");
      }
    } catch (err: any) {
      console.error("Flashcard Error:", err);
      // Fallback
      setCards([{ id: "fallback", front: "My API Key is missing or invalid.", back: "Please configure GEMINI_API_KEY in .env.local", mastered: false }]);
    } finally {
      setIsGenerating(false);
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  };

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150); // wait for flip animation to start reversing before changing text
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  const markMastered = () => {
    const newCards = [...cards];
    newCards[currentIndex].mastered = true;
    setCards(newCards);
    handleNext();
  };

  const resetProgress = () => {
    setCards(cards.map(c => ({...c, mastered: false})));
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const activeCard = cards[currentIndex];
  const masteredCount = cards.filter(c => c.mastered).length;

  if (cards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 h-full">
        <div className="w-24 h-24 bg-[#1a1a1a] rounded-2xl flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_30px_rgba(255,0,110,0.15)] transform rotate-12">
          <span className="text-5xl -rotate-12">🗂️</span>
        </div>
        <h2 className="text-3xl font-bold mb-4">Smart Flashcards</h2>
        <p className="text-white/60 max-w-md mb-8 leading-relaxed">
          Extract the most important concepts, terms, and mental models from <strong>{course.book.title}</strong> into an interactive spaced-repetition deck.
        </p>
        <Button 
          onClick={generateCards}
          disabled={isGenerating}
          className="h-14 px-8 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white font-bold text-lg rounded-full hover:scale-105 transition-transform"
        >
          {isGenerating ? "Extracting Concepts..." : "Generate Flashcards"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in pb-24 md:pb-8">
      
      {/* Header Info */}
      <div className="flex justify-between items-center mb-8 bg-[#1a1a1a] p-4 rounded-xl border border-white/10 shadow-lg">
        <div>
          <div className="text-xs text-[#00D4FF] font-bold uppercase tracking-wider mb-1">Deck Progress</div>
          <div className="text-lg font-bold">{masteredCount} / {cards.length} Mastered</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetProgress} className="border-white/20 hover:bg-white/10 text-white">Reset</Button>
        </div>
      </div>

      {/* 3D Flashcard Container */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        
        <div className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6">
          Card {currentIndex + 1} of {cards.length}
        </div>

        {/* The Card - Uses Tailwind arbitrary values for 3D transforms */}
        <div 
          className="relative w-full max-w-lg h-80 md:h-96 cursor-pointer group perspective-[1000px]"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div 
            className="w-full h-full relative"
            style={{ 
              transition: "transform 0.6s",
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
            }}
          >
            
            {/* Front of card */}
            <div 
              className="absolute inset-0 w-full h-full bg-[#111] border-2 border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl group-hover:border-[#00D4FF]/50 transition-colors"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
            >
              <span className="absolute top-6 left-6 text-xs font-bold text-[#00D4FF] uppercase tracking-widest bg-[#00D4FF]/10 px-3 py-1 rounded-full">Question</span>
              <h3 className="text-2xl md:text-3xl font-bold leading-tight">{activeCard.front}</h3>
              <p className="absolute bottom-6 text-sm text-white/30 italic">Click to flip</p>
            </div>

            {/* Back of card */}
            <div 
              className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border-2 border-[#FF006E]/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(255,0,110,0.15)]"
              style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <span className="absolute top-6 left-6 text-xs font-bold text-[#FF006E] uppercase tracking-widest bg-[#FF006E]/10 px-3 py-1 rounded-full">Answer</span>
              <div className="text-xl md:text-2xl text-white/90 leading-relaxed">{activeCard.back}</div>
            </div>

          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-8 w-full max-w-lg justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrev}
            className="w-14 h-14 rounded-full border-white/20 bg-transparent hover:bg-white/10"
          >
            ←
          </Button>

          <div className="flex gap-3">
            <Button 
              onClick={handleNext}
              className="h-14 px-6 bg-[#1a1a1a] border border-white/20 text-white hover:bg-white/10 font-bold rounded-xl"
            >
              Review Again
            </Button>
            <Button 
              onClick={markMastered}
              disabled={activeCard.mastered}
              className="h-14 px-6 bg-gradient-to-r from-[#00D4FF] to-[#0096ff] text-white font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            >
              {activeCard.mastered ? "Mastered ✓" : "Got It ✓"}
            </Button>
          </div>

          <Button 
            variant="outline" 
            onClick={handleNext}
            className="w-14 h-14 rounded-full border-white/20 bg-transparent hover:bg-white/10"
          >
            →
          </Button>
        </div>

      </div>
    </div>
  );
}
