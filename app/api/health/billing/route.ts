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

  const ready = admin.initializes && stripe.secretKeySet && stripe.publishableKeySet;

  return NextResponse.json({
    ready,
    expectedFirebaseProject: CLIENT_PROJECT_ID,
    firebaseAdmin: admin,
    stripe,
  });
}
