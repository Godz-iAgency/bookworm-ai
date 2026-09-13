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

  // This switch hides the client card gate; server authentication and quota
  // checks still require valid configuration, even while billing is paused.
  const billingPaused = process.env.NEXT_PUBLIC_BILLING_PAUSED === "true";

  const configReady = admin.initializes && Object.values(stripe).every(Boolean);

  /**
   * Which commit is actually serving this request.
   *
   * Vercel injects these at build time. Without them, "is my fix live yet?"
   * can only be answered by guessing from behaviour, and this project does not
   * always auto-deploy on push — so a fix that was pushed, a fix that was
   * deployed, and a fix that is actually running were indistinguishable, and
   * more than one bug in this app has been re-diagnosed when the real answer
   * was a stale build.
   */
  const deployment = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    env: process.env.VERCEL_ENV ?? "development",
  };

  return NextResponse.json({
    deployment,
    // A paused client gate cannot make broken server configuration ready.
    ready: configReady,
    billingPaused,
    // Whether paid billing COULD run if the pause switch were removed — stays
    // useful even while paused, so this doesn't need rechecking twice.
    configReady,
    expectedFirebaseProject: CLIENT_PROJECT_ID,
    firebaseAdmin: admin,
    stripe,
  });
}
