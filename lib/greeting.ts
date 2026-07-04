/**
 * A warm, time-of-day greeting for the Home header. Static (no AI) so it's
 * instant and free — a curated pool per time bucket, one picked at random each
 * visit, exactly like the greetings on claude.ai.
 */
export type TimeBucket = "morning" | "afternoon" | "evening" | "night";

const PHRASES: Record<TimeBucket, string[]> = {
  morning: ["Coffee and chapters", "Fresh start today", "A bright new page", "Morning momentum"],
  afternoon: ["A few pages await", "Keep the momentum", "Afternoon adventure", "Steady and curious"],
  evening: ["Wind down, read on", "Evening read awaits", "Unwind with a page", "Golden hour reading"],
  night: ["One more chapter?", "Night owl mode", "Quiet page, calm mind", "Late-night wisdom"],
};

export function getTimeBucket(hour: number): TimeBucket {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export interface Greeting {
  bucket: TimeBucket;
  phrase: string;
}

/** Pick a greeting for the given moment. Call once per visit (it's random). */
export function pickGreeting(now: Date): Greeting {
  const bucket = getTimeBucket(now.getHours());
  const pool = PHRASES[bucket];
  return { bucket, phrase: pool[Math.floor(Math.random() * pool.length)] };
}

/** The reader's first name for "Hi ___", with graceful fallbacks. */
export function greetingName(displayName: string | null | undefined, email: string | null | undefined): string {
  const fromDisplay = displayName?.trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;
  const fromEmail = email?.split("@")[0];
  if (fromEmail) return fromEmail;
  return "there";
}
