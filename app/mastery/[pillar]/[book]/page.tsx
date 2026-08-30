"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, BookOpen, Check } from "lucide-react";
import { BackButton } from "@/components/back-button";
import { BookCover } from "@/components/book-cover";
import { GeneratingOverlay } from "@/components/generating-overlay";
import { useAuth } from "@/context/AuthContext";
import { useBookwormContext } from "@/lib/BookwormContext";
import { bookBySlug, pillarBySlug } from "@/lib/mastery-library";
import { searchGoogleBooks } from "@/lib/api";
import { getUserProfile } from "@/lib/firebase/profile";
import { READING_LEVELS } from "@/lib/reading-levels";
import { useCourseGeneration } from "@/lib/useCourseGeneration";

/**
 * One recommended book. Starting it produces exactly the same 7-day course as
 * typing the title into search: same generator, same reader, same expiry, and
 * the same one-against-your-monthly-quota. Personal Development is a curated way
 * IN to the course, not a different kind of content.
 */
export default function MasteryBookPage({
  params,
}: {
  params: Promise<{ pillar: string; book: string }>;
}) {
  const { pillar: pillarSlug, book: bookSlug } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { courses, setCurrentBook, setActiveCourseId } = useBookwormContext();
  const { start, isGenerating, genStep, error: genError } = useCourseGeneration();

  const [lookupError, setLookupError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // The level chosen during onboarding. null while loading; "" for accounts
  // that predate onboarding asking, which route through /reading-level instead.
  const [savedLevel, setSavedLevel] = useState<string | null>(null);

  const pillar = pillarBySlug(pillarSlug);
  const book = bookBySlug(pillarSlug, bookSlug);

  // Already on the shelf? Then this is a "keep reading" screen, not a start one.
  const existing = book
    ? courses.find(
        (c) => c.book.title.trim().toLowerCase() === book.title.trim().toLowerCase()
      )
    : undefined;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (loading) return;
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
  }, [user, loading]);

  /**
   * Turn a catalog entry into a real course.
   *
   * The library stores only a title and author, but a course needs a cover and
   * a description, so the book is looked up the same way a typed search would
   * look it up. That also means a Personal Development book lands on the shelf
   * indistinguishable from one the reader found themselves, which is the point.
   */
  const handleStart = useCallback(async () => {
    if (!book || savedLevel === null || starting) return;
    setLookupError(null);
    setStarting(true);

    try {
      const found = await searchGoogleBooks(`${book.title} ${book.author}`);
      const resolved = found ?? {
        // The catalog is the source of truth for what this book IS; the lookup
        // only decorates it. A search miss must not block a curated title.
        title: book.title,
        author: book.author,
        coverUrl: "",
        description: "",
      };

      setCurrentBook(resolved);

      if (savedLevel) {
        await start(resolved, savedLevel);
      } else {
        router.push("/reading-level");
      }
    } catch (e) {
      console.error("Could not start this course:", e);
      setLookupError("We couldn't start this course right now. Please try again in a moment.");
    } finally {
      setStarting(false);
    }
  }, [book, savedLevel, starting, setCurrentBook, start, router]);

  if (loading || !user) return null;

  if (!pillar || !book) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0a0a0a] p-6 text-center text-white">
        <p className="text-white/70">That book isn&apos;t in the library.</p>
        <Link
          href="/mastery"
          className="rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] px-6 py-2.5 font-bold"
        >
          Back to Personal Development
        </Link>
      </div>
    );
  }

  if (isGenerating) {
    return <GeneratingOverlay step={genStep} />;
  }

  const error = lookupError ?? genError;
  const busy = starting || savedLevel === null;

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto bg-[#0a0a0a] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/50" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col px-4 pb-20 pt-4">
        <div className="mb-5 flex items-center gap-2">
          <BackButton to={`/mastery/${pillarSlug}`} label={`Back to ${pillar.name}`} />
          <Link href="/dashboard" aria-label="Back to your shelf">
            <Image
              src="/bookworm-logo.png"
              alt="Bookworm.AI"
              width={92}
              height={24}
              priority
              className="opacity-90"
            />
          </Link>
        </div>

        <div className="flex items-start gap-4">
          <BookCover
            title={book.title}
            author={book.author}
            className="h-[104px] w-[72px] shrink-0 shadow-lg"
            rounded="rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-[#00D4FF]">
              {pillar.name}
            </p>
            <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight md:text-3xl">
              {book.title}
            </h1>
            <p className="mt-1 text-sm text-white/55">{book.author}</p>
          </div>
        </div>

        {existing ? (
          /* Already generated: don't offer to spend another generation on it. */
          <div className="mt-8">
            <div className="flex items-center gap-2.5 rounded-2xl border border-[#00D4FF]/30 bg-[#00D4FF]/[0.07] px-4 py-3.5">
              <Check className="h-5 w-5 shrink-0 text-[#00D4FF]" strokeWidth={2.5} />
              <p className="text-sm text-white/80">
                This one is already on your shelf.
              </p>
            </div>
            <button
              onClick={() => {
                setActiveCourseId(existing.id);
                router.push("/dashboard");
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.02]"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2.5} />
              Continue reading
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="rounded-2xl border border-white/10 bg-[#1a1a1a]/60 p-5">
              <h2 className="mb-2 font-bold">What you&apos;ll get</h2>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>The whole book compressed into 7 daily
                  lessons, following the author&apos;s real structure front to back.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>The author&apos;s actual frameworks and
                  terminology, worked through their own examples.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#00D4FF]">✓</span>Flashcards and a chat companion for every
                  day, at your reading level.
                </li>
              </ul>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E] py-3.5 text-base font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" strokeWidth={2.5} />
              {starting ? "Starting..." : "Start the 7-day course"}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-white/40">
              This uses one of your monthly book generations, the same as any other book.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
