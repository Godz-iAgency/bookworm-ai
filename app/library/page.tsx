"use client";

import { useEffect, useState } from "react";
import { StoredBookCover } from "@/components/book-cover";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { useBookwormContext } from "@/lib/BookwormContext";

interface SavedBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  description: string;
}

export default function LibraryPage() {
  const router = useRouter();
  const { setCurrentBook } = useBookwormContext();
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleDelete = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // Prevent triggering the card's select event
    try {
      await deleteDoc(doc(db, "books", bookId));
      setBooks((prev) => prev.filter((book) => book.id !== bookId));
    } catch (error) {
      console.error("Error deleting book:", error);
    }
  };

  const handleSelectBook = (book: SavedBook) => {
    setCurrentBook(book);
    router.push("/dashboard");
  };

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const q = query(collection(db, "books"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        const fetchedBooks: SavedBook[] = [];
        snapshot.forEach((doc) => {
          fetchedBooks.push({ id: doc.id, ...doc.data() } as SavedBook);
        });
        
        setBooks(fetchedBooks);
      } catch (error) {
        console.error("Error fetching library:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooks();
  }, []);

  return (
    <div className="relative min-h-dvh w-full bg-[#0a0a0a] bg-dot-grid text-white overflow-y-auto">
      {/* Background overlay for dot grid */}
      <div className="fixed inset-0 bg-black/40 z-0 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8">
        <div className="sticky top-0 z-50 flex justify-between items-center mb-10 -mx-6 px-6 py-4 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5 animate-in fade-in slide-in-from-top-4 duration-500">
          <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#FF006E]">
            My Library
          </h1>
          <Link href="/search">
            <Button variant="outline" className="border-white/20 bg-[#1a1a1a]/50 text-white/90 font-semibold hover:bg-white/10 rounded-xl px-6 h-11 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              Back to Search
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64 animate-in fade-in duration-500">
            <p className="text-xl text-white/70 animate-pulse font-medium tracking-wide">
              Loading your library...
            </p>
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-[#1a1a1a]/80 backdrop-blur-md rounded-2xl border border-white/10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-xl text-white/60 mb-6 font-medium">Your library is currently empty.</p>
            <Link href="/search">
              <Button className="h-12 px-8 bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white font-bold text-lg rounded-xl hover:scale-105 transition-transform duration-300">
                Find a Book
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {books.map((book) => (
              <div 
                key={book.id} 
                onClick={() => handleSelectBook(book)}
                className="bg-[#1a1a1a]/80 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow-2xl flex flex-col items-center text-center transition-all hover:border-[#00D4FF] hover:bg-[#222222]/90 hover:-translate-y-1 group cursor-pointer relative"
              >
                <button
                  onClick={(e) => handleDelete(e, book.id)}
                  className="absolute top-3 right-3 z-20 text-white/40 hover:text-[#FF006E] bg-black/40 hover:bg-black/80 rounded-full p-2 backdrop-blur-sm transition-all shadow-md active:scale-95"
                  title="Delete Book"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
                <StoredBookCover
                  title={book.title}
                  author={book.author}
                  coverUrl={book.coverUrl}
                  className="w-32 h-48 mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/5 group-hover:scale-[1.03] transition-transform duration-300"
                  rounded="rounded-md"
                />
                <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 w-full px-2" title={book.title}>
                  {book.title}
                </h3>
                <p className="text-[#00D4FF] text-sm font-medium line-clamp-1 w-full px-2">
                  by {book.author}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
