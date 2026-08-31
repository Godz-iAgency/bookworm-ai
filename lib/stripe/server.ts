import Stripe from "stripe";

/**
 * Server-only Stripe client. Throws lazily (on first use, not at import
 * time) when STRIPE_SECRET_KEY isn't configured, so the app still builds
 * and boots before billing is wired up — same "inert until configured"
 * posture as the rest of the Stripe routes.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  return _stripe;
}

export type PlanId = "page_turner" | "well_read" | "book_club";

/**
 * A price id straight from Vercel's env, trimmed.
 *
 * A trailing newline pasted into a dashboard field is invisible there and
 * turns "price_1TzyYBENU0XPtum1EKMUdimg" into "price_1TzyYBENU0XPtum1EKMUdimg\n"
 * once it reaches this process — a string Stripe has never heard of, so every
 * subscription attempt failed with "No such price" and no clue why. Same
 * failure shape as the Firebase Admin key issue, same fix: never trust a
 * pasted env var to be exactly what was intended.
 */
function envPriceId(envVar: string): string | undefined {
  return process.env[envVar]?.trim() || undefined;
}

/** Maps a plan id to its Stripe Price env var. Throws if that price isn't configured. */
export function priceIdForPlan(planId: PlanId): string {
  const envVar =
    planId === "page_turner"
      ? "STRIPE_PRICE_PAGE_TURNER"
      : planId === "well_read"
        ? "STRIPE_PRICE_WELL_READ"
        : "STRIPE_PRICE_BOOK_CLUB";
  const priceId = envPriceId(envVar);
  if (!priceId) throw new Error(`${envVar} is not configured.`);
  return priceId;
}

/** Reverse lookup: Stripe Price id -> our plan id. Used to sync plan from webhook events. */
export function planForPriceId(priceId: string): PlanId | null {
  if (priceId === envPriceId("STRIPE_PRICE_PAGE_TURNER")) return "page_turner";
  if (priceId === envPriceId("STRIPE_PRICE_WELL_READ")) return "well_read";
  if (priceId === envPriceId("STRIPE_PRICE_BOOK_CLUB")) return "book_club";
  return null;
}
