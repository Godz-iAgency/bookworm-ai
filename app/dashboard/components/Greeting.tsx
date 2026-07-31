"use client";

import { useState } from "react";
import { Coffee, Sun, Sunset, Moon, type LucideIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { pickGreeting, greetingName, type TimeBucket } from "@/lib/greeting";

const BUCKET_ICON: Record<TimeBucket, LucideIcon> = {
  morning: Coffee,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

// Top-right of the Home header: "Hi {name}" + a rotating time-of-day phrase.
// The phrase is picked once on mount (useState initializer) so it stays put
// across the dashboard's per-minute clock re-renders.
export default function Greeting() {
  const { user } = useAuth();
  const [greeting] = useState(() => pickGreeting(new Date()));
  const name = greetingName(user?.displayName, user?.email);
  const Icon = BUCKET_ICON[greeting.bucket];

  return (
    <div className="min-w-0 text-center leading-none">
      {/* Handwritten display font (Caveat) makes the greeting feel personal and
          warm, not like a cold UI header. Paired with the crisp gradient phrase.
          Sized to stay on ONE line in the header's narrow centre column — at its
          old 34px a name like "Christopher" wrapped and pushed the shelf itself
          most of the way off a phone screen. */}
      <p
        className="truncate text-[25px] md:text-[30px] font-semibold leading-tight text-white"
        style={{ fontFamily: "var(--font-caveat)" }}
      >
        Hi {name}
      </p>
      <div className="mt-0.5 flex items-center justify-center gap-1">
        <Icon className="h-3 w-3 shrink-0 text-[#00D4FF]" strokeWidth={2} />
        <span className="truncate bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-[11px] font-bold text-transparent">
          {greeting.phrase}
        </span>
      </div>
    </div>
  );
}
