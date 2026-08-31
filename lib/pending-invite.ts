"use client";

/**
 * Carries a Book Club invite across the sign-up detour.
 *
 * Someone who is handed an invite link almost never already has an account -
 * that is the whole point of inviting them - so the link's first act is to
 * send them to sign up. Whatever it remembers has to survive that trip, or the
 * invite is silently dropped: they end up with an ordinary free account, the
 * club never gains a member, and nothing anywhere says why. That was exactly
 * the state of things before this existed. /join wrote the code down and no
 * code path ever read it back.
 *
 * sessionStorage rather than a query string on the auth pages: the code is a
 * capability (whoever holds it can join the club), so it has no business
 * sitting in a URL that gets shared, screenshotted, or logged.
 */

const KEY = "pendingInviteCode";

/** Remember an invite the reader can't act on yet because they aren't signed in. */
export function storePendingInvite(code: string): void {
  try {
    window.sessionStorage.setItem(KEY, code);
  } catch {
    // Private mode, or storage disabled. The reader can still open the link
    // again after signing up, which is the same recovery either way.
  }
}

export function readPendingInvite(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if it could never be written.
  }
}

/**
 * Where a just-authenticated reader should land.
 *
 * A brand-new account always goes to onboarding first, invite or not: joining
 * a club is pointless without a reading level, since every course generation
 * needs one. Onboarding then hands off to the invite itself (see
 * app/onboarding/page.tsx), so the detour is preserved rather than skipped.
 */
export function destinationAfterAuth(isNewAccount: boolean): string {
  if (isNewAccount) return "/onboarding";
  const code = readPendingInvite();
  return code ? `/join/${code}` : "/dashboard";
}

/** Where onboarding should send a reader once their preferences are saved. */
export function destinationAfterOnboarding(): string {
  const code = readPendingInvite();
  return code ? `/join/${code}` : "/search";
}
