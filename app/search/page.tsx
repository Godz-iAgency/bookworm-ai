"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBookwormContext, Book } from "@/lib/BookwormContext";
import { searchGoogleBooks } from "@/lib/api";

export default function SearchPage() {
  const router = useRouter();
  const { setCurrentBook } = useBookwormContext();
  
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchedBook, setSearchedBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (searchedBook) {
      setCurrentBook(searchedBook);
      // LOOP RULE: ONLY navigate forward when this button is clicked
      router.push("/reading-level");
    }
  };

  const handleDecline = () => {
    setSearchedBook(null);
    setQuery("");
    setError("Try adding the author's name for better results");
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] bg-dot-grid text-white overflow-hidden flex flex-col items-center">
      {/* Background overlay for dot grid */}
      <div className="absolute inset-0 bg-black/40 z-0" />
      
      {/* Header with logo and step indicator */}
      <div className="w-full max-w-4xl px-6 py-8 flex justify-between items-center z-10">
        <Image src="/bookworm-logo.png" alt="Bookworm.AI" width={150} height={40} priority className="opacity-90" />
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
            <p className="text-xl mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E] font-medium">
              by {searchedBook.author}
            </p>
            
            <p className="text-white/70 mb-8 max-w-sm">
              {searchedBook.description}
            </p>
            
            <div className="flex flex-col gap-3 w-full">
              <Button 
                onClick={handleConfirm}
                className="w-full h-14 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white font-bold text-lg rounded-xl transition-transform hover:scale-105"
              >
                Yes, that's it!
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
