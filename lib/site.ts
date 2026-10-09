/**
 * What search engines and link previews are told about the site. One place, so
 * the home page, the sitemap, the share image and the structured data cannot
 * drift apart.
 */
export const SITE_URL = "https://bookworm-ai.app";
export const SITE_NAME = "Bookworm AI";
export const SITE_TITLE = "Bookworm AI: Turn Any Book Into a 7-Day Learning Course";
export const SITE_DESCRIPTION =
  "Bookworm AI turns any book into a 7-day course with a daily lesson, three actions to apply it, flashcards and an AI chat. Day 1 is free to read.";

/**
 * Pages worth sending someone to from a search result. Everything behind a
 * sign-in (dashboard, courses, admin, guest links) is left out on purpose, and
 * app/robots.ts keeps crawlers away from it.
 */
export const PUBLIC_PATHS = ["/", "/pricing", "/signup", "/contact", "/privacy", "/terms"] as const;

/** Routes that only make sense for a signed-in reader or for the founder. */
export const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/dashboard",
  "/go/",
  "/preview",
  "/onboarding",
  "/search",
  "/reading-level",
  "/course",
  "/mastery",
  "/book-club",
  "/join",
  "/qr",
  "/offline",
  "/auth",
  "/library",
  "/settings",
] as const;
