/**
 * Complimentary access — accounts that skip billing entirely.
 *
 * Three things needed the same underlying idea, so they share one: the
 * Founders Podcast demo (one book, then it stops), the Hudson reading account
 * (unlimited books, five open at a time, no card ever), and any future demo
 * link handed to a partner. Rather than three special cases threaded through
 * the billing gate, an account simply carries an `accessOverride` and the gate
 * reads it first.
 *
 * Written ONLY by the Admin SDK (firestore.rules denies it to clients), for
 * the obvious reason: a client-writable "I don't pay" flag is not a flag, it
 * is a free tier with extra steps.
 */

export interface AccessOverride {
  /** Shown on the admin screen so a link is recognisable a year from now. */
  label: string;
  /**
   * Total books this account may ever generate. null = no limit.
   *
   * Counted against `generationsThisMonth`, which despite its name is a
   * lifetime tally here: that counter is only ever reset by Stripe's
   * invoice.payment_succeeded webhook, and an account that skips billing has
   * no subscription and therefore no invoice to reset it.
   */
  lifetimeGenerations: number | null;
  /** How many books may sit on the shelf at once. */
  maxOpenBooks: number;
  /** The kill switch. Flipped from the admin dashboard; revokes instantly. */
  active: boolean;
}

/** The override to honour right now, or null if there is none / it is off. */
export function activeOverride(
  profile: { accessOverride?: AccessOverride | null } | null | undefined,
): AccessOverride | null {
  const override = profile?.accessOverride;
  return override && override.active ? override : null;
}

/**
 * A sign-in link that needs no password.
 *
 * Held in /accessLinks/{token}; whoever has the token can sign in as the
 * account it points at, which is the entire point — the Founders demo has to
 * work from a tap in a message, and a nine-year-old should not be typing a
 * password. The token is long and random, it is never shown to anyone who
 * isn't sent it, and it can be switched off from the admin dashboard the
 * moment it has done its job.
 */
export interface AccessLink {
  token: string;
  uid: string;
  label: string;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  /** The account's current override, joined in for the admin screen. */
  email?: string | null;
  booksUsed?: number;
  bookLimit?: number | null;
}
