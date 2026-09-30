import { AsyncLocalStorage } from "node:async_hooks";
import { CHRISTOPHER_READER_UID } from "./admin";

/**
 * Which Gemini key pays for a request.
 *
 * Two keys, two Google projects:
 *   - "free": GEMINI_API_KEY, the free-tier key. Serves the founder's own
 *     reading accounts and every complimentary account (the demo links).
 *   - "paid": GEMINI_API_KEY_PAID, the key with billing on. Serves everyone
 *     else: trials, previews and paying readers.
 *
 * A complimentary account never touches the paid key, whatever happens: if
 * the free key runs out its requests fall to the usual Groq backup, not to
 * the card. A regular reader uses the free key only while no paid key has
 * been configured at all, so nothing breaks in the gap before it is added.
 *
 * The tier rides along the request in AsyncLocalStorage, set once by the route
 * that has already decided who is asking, so the generation code underneath
 * (lessons, expansions, repairs, study aids) needs no extra parameters.
 */
export type AiKeyTier = "free" | "paid";

const tiers = new AsyncLocalStorage<AiKeyTier>();

/** Runs a generation on behalf of a reader of the given tier. */
export function withAiKey<T>(tier: AiKeyTier, task: () => Promise<T>): Promise<T> {
  return tiers.run(tier, task);
}

/**
 * Whose key a reader gets. Free for the founder's own reading account, for
 * anyone in the Book Club he owns (his son's account), and for any account
 * carrying an active complimentary override. Paid for everyone else.
 */
export function keyTierFor(
  uid: string,
  complimentary: boolean,
  clubOwnerId: string | null | undefined,
): AiKeyTier {
  return complimentary || uid === CHRISTOPHER_READER_UID || clubOwnerId === CHRISTOPHER_READER_UID ? "free" : "paid";
}

/** Set as soon as a route has admitted a request (see guardAI). */
export const aiKeyTiers = new WeakMap<Request, AiKeyTier>();
export const keyTierOfRequest = (req: Request): AiKeyTier => aiKeyTiers.get(req) ?? "paid";

let warnedNoPaidKey = false;

/** The key to call Gemini with, and which one it is. Never logged. */
export function geminiKey(): { key: string | undefined; tier: AiKeyTier; name: string } {
  const tier = tiers.getStore() ?? "paid";
  if (tier === "free") return { key: process.env.GEMINI_API_KEY, tier, name: "GEMINI_API_KEY" };
  const paid = process.env.GEMINI_API_KEY_PAID;
  if (paid) return { key: paid, tier, name: "GEMINI_API_KEY_PAID" };
  if (!warnedNoPaidKey) {
    warnedNoPaidKey = true;
    console.warn("[ai] GEMINI_API_KEY_PAID is not set. Regular readers are being served by the free key until it is added.");
  }
  return { key: process.env.GEMINI_API_KEY, tier, name: "GEMINI_API_KEY" };
}
