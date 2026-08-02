"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBookwormContext, Book } from "@/lib/BookwormContext";
import { searchGoogleBooks } from "@/lib/api";
import { BackButton } from "@/components/back-button";
import { GeneratingOverlay } from "@/components/generating-overlay";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/firebase/profile";
import { READING_LEVELS } from "@/lib/reading-levels";
import { useCourseGeneration } from "@/lib/useCourseGeneration";

export default function SearchPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { setCurrentBook } = useBookwormContext();
  const { start, isGenerating, genStep, error: genError } = useCourseGeneration();

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchedBook, setSearchedBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The level chosen during onboarding. When it's known, confirming a book
  // generates immediately — asking again on a separate screen would be asking
  // the same question twice in one sitting. null means we haven't loaded it
  // yet; "" means this account predates onboarding asking for one.
  const [savedLevel, setSavedLevel] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    // Signed out, or the lookup failed: fall back to "" so the confirm button
    // still works and routes through /reading-level (which sends a signed-out
    // visitor to /login). Leaving it null would disable the button forever.
    if (!user) {
      setSavedLevel("");
      return;
    }
    let cancelled = false;
    getUserProfile(user.uid)
      .then((profile) => {
        if (cancelled) return;
        const lvl = profile?.readingLevel ?? "";
        setSavedLevel(READING_LEVELS.some((l) => l.id === lvl) ? lvl : "");
      })
      .catch((e) => {
        console.error("Could not load reading level:", e);
        if (!cancelled) setSavedLevel("");
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchedBook(null); // Return to state 1 visually while loading
    
    try {
      const book = await searchGoogleBooks(query);
      if (book) {
        setSearchedBook(book);
      } else {
        setError("We couldn't find that book. Try adding the author's name for better results.");
      }
    } catch (err) {
      setError("An error occurred while searching. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!searchedBook) return;
    setCurrentBook(searchedBook);
    // Level already settled during onboarding — go straight to the course.
    // Otherwise fall back to the standalone step for accounts that never had
    // a level asked for.
    if (savedLevel) {
      void start(searchedBook, savedLevel);
    } else {
      router.push("/reading-level");
    }
  };

  const handleDecline = () => {
    setSearchedBook(null);
    setQuery("");
    setError("Try adding the author's name for better results");
  };

  if (isGenerating) return <GeneratingOverlay step={genStep} />;

  const activeLevel = READING_LEVELS.find((l) => l.id === savedLevel);

  return (
    <div className="relative min-h-dvh w-full bg-[#0a0a0a] bg-dot-grid text-white overflow-hidden flex flex-col items-center">
      {/* Background overlay for dot grid */}
      <div className="absolute inset-0 bg-black/40 z-0" />
      
      {/* Header with logo and step indicator */}
      <div className="w-full max-w-4xl px-6 py-8 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          {/* Back + logo both return to the shelf. /search is only reached by a
              signed-in user, so /dashboard is always the right destination (a
              brand-new user with no courses is bounced right back here). */}
          <BackButton to="/dashboard" label="Back to your shelf" />
          <Link href="/dashboard" aria-label="Back to your shelf">
            <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={150} height={40} priority className="opacity-90 transition-opacity hover:opacity-100" />
          </Link>
        </div>
        <div className="text-sm font-medium tracking-widest text-[#00D4FF] uppercase">
          Step 1 of 2
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xl px-4 z-10 -mt-20">
        {!searchedBook ? (
          /* STATE 1: SEARCH SCREEN */
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl md:text-5xl font-bold mb-8 text-center tracking-tight">
              What book do you want to master?
            </h1>
            
            <form onSubmit={handleSearch} className="flex flex-col gap-4">
              <div className="flex gap-2 w-full">
                <Input
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/40 h-14 text-lg rounded-xl focus-visible:ring-[#00D4FF]"
                  placeholder="Enter a book title..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="h-14 px-8 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white font-semibold text-lg rounded-xl transition-transform hover:scale-105"
                >
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>
              {error && (
                <p className="text-[#FF006E] text-sm text-center font-medium mt-2">{error}</p>
              )}
            </form>
          </div>
        ) : (
          /* STATE 2: CONFIRMATION CARD */
          <div className="w-full bg-[#1a1a1a]/80 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-2xl animate-in flip-in-y duration-500 flex flex-col items-center text-center">
            <div className="w-32 h-48 relative mb-6 rounded-md overflow-hidden shadow-lg border border-white/10">
              <Image 
                src={searchedBook.coverUrl} 
                alt={searchedBook.title} 
                fill 
                className="object-cover"
                unoptimized
              />
            </div>
            
            <h2 className="text-3xl font-bold mb-2 tracking-tight">{searchedBook.title}</h2>
            <p className="text-xl mb-4 font-medium text-white/80">
              by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E]">{searchedBook.author || "Unknown Author"}</span>
            </p>
            
            <p className="text-white/70 mb-6 max-w-sm">
              {searchedBook.description}
            </p>

            {/* The level this course will be written in, with an escape hatch.
                Shown rather than re-asked, so the reader can override it for
                this book without being made to choose again by default. */}
            {activeLevel && (
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="text-white/50">Written for</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00D4FF]/40 bg-[#00D4FF]/10 px-3 py-1 font-semibold text-white">
                  <activeLevel.Icon className="h-3.5 w-3.5 text-[#00D4FF]" strokeWidth={2} />
                  {activeLevel.label}
                </span>
                <button
                  onClick={() => {
                    setCurrentBook(searchedBook);
                    router.push("/reading-level");
                  }}
                  className="font-semibold text-[#00D4FF] underline-offset-2 transition-opacity hover:opacity-80 hover:underline"
                >
                  change
                </button>
              </div>
            )}

            {genError && (
              <div className="mb-4 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
                {genError}
              </div>
            )}

            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={handleConfirm}
                disabled={isSaving || savedLevel === null}
                className="w-full h-14 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white font-bold text-lg rounded-xl transition-transform hover:scale-105 disabled:opacity-70 disabled:hover:scale-100"
              >
                {isSaving ? "Saving..." : "Yes, that's it!"}
              </Button>
              <Button 
                onClick={handleDecline}
                variant="outline"
                className="w-full h-14 border-white/20 bg-transparent text-white/90 font-semibold text-lg hover:bg-white/10 rounded-xl"
              >
                No, try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
