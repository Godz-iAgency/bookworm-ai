"use client";

import { GENRES, GENRE_PICK_COUNT } from "@/lib/genres";

interface GenreGridProps {
  selected: string[];
  onToggle: (genre: string) => void;
  max?: number;
}

/**
 * The pick-your-genres grid, shared by onboarding and Profile so the two never
 * drift. Presentational: the parent owns the `selected` state and toggle logic
 * (see toggleGenre in lib/genres). Non-selected tiles disable once `max` is hit.
 */
export function GenreGrid({ selected, onToggle, max = GENRE_PICK_COUNT }: GenreGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {GENRES.map((genre) => {
        const isSelected = selected.includes(genre);
        const atMax = !isSelected && selected.length >= max;
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onToggle(genre)}
            disabled={atMax}
            aria-pressed={isSelected}
            className={`min-h-[40px] rounded-xl border px-3 py-2 text-sm font-bold transition-all ${
              isSelected
                ? "border-transparent bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white shadow-[0_0_15px_rgba(0,212,255,0.3)]"
                : atMax
                ? "border-white/10 bg-[#1a1a1a] text-white/70"
                : "border-white/10 bg-[#1a1a1a] text-white/70 hover:border-[#FF006E]/60 hover:text-white hover:shadow-[0_0_14px_rgba(255,0,110,0.3)]"
            } ${atMax ? "cursor-not-allowed opacity-40" : ""}`}
          >
            {genre}
          </button>
        );
      })}
    </div>
  );
}
