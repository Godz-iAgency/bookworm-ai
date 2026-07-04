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
    <div className="text-center leading-none">
      {/* Handwritten display font (Caveat) makes the greeting feel personal and
          warm, not like a cold UI header. Paired with the crisp gradient phrase. */}
      <p
        className="text-[34px] md:text-[38px] font-semibold text-white"
        style={{ fontFamily: "var(--font-caveat)" }}
      >
        Hi {name}
      </p>
      <div className="mt-0.5 flex items-center justify-center gap-1.5">
        <Icon className="h-4 w-4 text-[#00D4FF]" strokeWidth={2} />
        <span className="bg-gradient-to-r from-[#00D4FF] to-[#FF006E] bg-clip-text text-sm font-bold text-transparent">
          {greeting.phrase}
        </span>
      </div>
    </div>
  );
}
