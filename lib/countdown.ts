/**
 * The 8-day expiry countdown shown on course cards + the course detail view.
 * Escalates in urgency as the window closes; copy says "disappears", never
 * "delete". Single source of truth so every place stays consistent.
 */
export interface Countdown {
  label: string;
  className: string;
  daysLeft: number;
  expired: boolean;
}

export function getCountdown(expiresAt: string, now: Date): Countdown {
  const end = new Date(expiresAt).getTime();
  const expired = end < now.getTime();
  const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24)));

  if (expired) {
    return { label: "Expired", className: "text-[#FF006E] border-[#FF006E]/30 bg-[#FF006E]/10", daysLeft, expired };
  }
  if (daysLeft <= 1) {
    return {
      label: "Disappears today",
      className:
        "text-[#FF006E] border-[#FF006E]/50 bg-[#FF006E]/15 animate-pulse shadow-[0_0_12px_rgba(255,0,110,0.45)]",
      daysLeft,
      expired,
    };
  }
  if (daysLeft <= 3) {
    return { label: `${daysLeft} days left`, className: "text-[#FFB020] border-[#FFB020]/40 bg-[#FFB020]/10", daysLeft, expired };
  }
  return { label: `${daysLeft} days left`, className: "text-[#00D4FF] border-[#00D4FF]/30 bg-[#00D4FF]/10", daysLeft, expired };
}
