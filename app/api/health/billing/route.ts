import { NextResponse } from "next/server";
import { getAdminConfigStatus, CLIENT_PROJECT_ID } from "@/lib/firebase/admin";

/**
 * Is billing actually wired up on THIS deployment?
 *
 * Every Stripe route needs the Firebase Admin SDK to verify the caller's ID
 * token before it does anything. When those credentials are missing or
 * malformed the reader just sees a card form that fails, with no way to tell
 * a server misconfiguration apart from a genuine sign-in problem — and env
 * vars that are correct locally say nothing about what the deploy has.
 *
 * Reports presence and shape only: booleans, variable names, and the project
 * id that is already public in the client bundle. No secret value is ever
 * read into the response.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = getAdminConfigStatus();

  const stripe = {
    secretKeySet: !!process.env.STRIPE_SECRET_KEY,
    publishableKeySet: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    webhookSecretSet: !!process.env.STRIPE_WEBHOOK_SECRET,
    pricePageTurnerSet: !!process.env.STRIPE_PRICE_PAGE_TURNER,
    priceWellReadSet: !!process.env.STRIPE_PRICE_WELL_READ,
    priceBookClubSet: !!process.env.STRIPE_PRICE_BOOK_CLUB,
  };

  // The kill switch in lib/billing.ts's isBillingEnabled(). When it's on, the
  // app never calls any of the routes this check is diagnosing, so a broken
  // admin credential stops mattering to what a reader actually experiences.
  const billingPaused = process.env.NEXT_PUBLIC_BILLING_PAUSED === "true";

  const configReady = admin.initializes && stripe.secretKeySet && stripe.publishableKeySet;

  return NextResponse.json({
    // What matters to a reader right now: is the app either working (paused)
    // or fully configured? False only means readers are hitting the broken
    // trial gate.
    ready: billingPaused || configReady,
    billingPaused,
    // Whether paid billing COULD run if the pause switch were removed — stays
    // useful even while paused, so this doesn't need rechecking twice.
    configReady,
    expectedFirebaseProject: CLIENT_PROJECT_ID,
    firebaseAdmin: admin,
    stripe,
  });
}
