/**
 * The core funnel: Day 1 read → card added (Days 2 to 7 unlocked) → paid after
 * the 7-day trial → a second, different book generated.
 *
 * Pure functions over one row per account, so the Control Centre can re-slice
 * by date range and creator instantly, and so every rule here is tested
 * without Firebase or Stripe (tests/funnel.cjs). The server decides what each
 * row's dates are (app/api/admin/metrics/route.ts); this file only decides
 * what they add up to.
 *
 * Cohorts are by sign-up date. Each stage's rate only counts people who have
 * had a fair chance to reach it: someone who read Day 1 an hour ago is not yet
 * a "did not add a card", and someone whose trial ends on Friday is not yet a
 * "did not pay". Those people are reported as pending, never as failures.
 */

export interface FunnelUser {
  id: string;
  email: string | null;
  signedUpAt: string;
  /** Accounts that never go through the trial funnel, left out of it entirely. */
  excluded: null | "admin" | "complimentary" | "club_member";
  /** Creator / referral code the account arrived with, if any. */
  source: string | null;
  readingLevel: string | null;
  language: string | null;
  /** When the reader actually started reading Day 1 of their first course. */
  day1At: string | null;
  /** "event" when recorded live; "reconstructed" when inferred from a completed Day 1. */
  day1Via: "event" | "reconstructed" | null;
  /** Card saved and the trial subscription created (Days 2 to 7 unlocked). */
  cardAt: string | null;
  trialEndsAt: string | null;
  /** First invoice Stripe marked paid for more than $0. */
  paidAt: string | null;
  /** Set when that first payment was refunded in full. */
  refundedAt: string | null;
  firstBookAt: string | null;
  firstBookTitle: string | null;
  secondBookAt: string | null;
  secondBookTitle: string | null;
  /** Distinct books this account has generated, ever. */
  distinctBooks: number;
}

/** How long each stage gets before a miss counts as a miss. */
export const FUNNEL_WINDOWS = {
  /** From sign-up to reading Day 1. */
  day1Ms: 24 * 3600_000,
  /** From reading Day 1 to adding a card. */
  cardMs: 48 * 3600_000,
  /** After the trial ends, for Stripe to finish (or fail) the first charge. */
  paidGraceMs: 72 * 3600_000,
  /** From the first payment to a second book: one billing month. */
  book2Ms: 30 * 24 * 3600_000,
} as const;

const TRIAL_MS = 7 * 24 * 3600_000;

export type StageKey = "day1" | "card" | "paid" | "book2";

export const STAGE_LABELS: Record<StageKey, string> = {
  day1: "Day 1 activated",
  card: "Card added / Day 2 unlocked",
  paid: "Paid after 7-day trial",
  book2: "Second book generated",
};

export interface StageResult {
  key: StageKey;
  label: string;
  /** Reached this stage (from the previous stage's population). */
  reached: FunnelUser[];
  /** Had their full window and did not reach it. */
  dropped: FunnelUser[];
  /** Still inside their window: neither a success nor a failure yet. */
  pending: FunnelUser[];
  /** reached / (reached + dropped); null while nobody has had a full window. */
  rate: number | null;
}

export interface FunnelRange {
  /** Inclusive, ISO. Omitted = from the beginning. */
  from?: string;
  /** Exclusive, ISO. Omitted = up to now. */
  to?: string;
  /** Creator code; "" means accounts with no code; undefined means everyone. */
  source?: string;
}

export interface FunnelResult {
  /** Accounts in the cohort that the funnel measures. */
  eligible: FunnelUser[];
  /** Accounts in the cohort that the funnel leaves out, and why. */
  excluded: FunnelUser[];
  stages: StageResult[];
  /** Day 1 → second book, over readers whose whole journey has resolved. */
  overall: { reached: number; resolved: number; rate: number | null };
  /** Median days from the first book to the second, when there is one. */
  medianDaysToBook2: number | null;
  /** Added a card with no Day 1 read recorded; not in the stage-2 numbers. */
  cardWithoutDay1: FunnelUser[];
}

const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const has = (iso: string | null | undefined) => Number.isFinite(t(iso));

export function inCohort(u: FunnelUser, range: FunnelRange): boolean {
  const s = t(u.signedUpAt);
  if (!Number.isFinite(s)) return false;
  if (range.from && s < t(range.from)) return false;
  if (range.to && s >= t(range.to)) return false;
  if (range.source !== undefined && (u.source ?? "") !== range.source) return false;
  return true;
}

/** A successful paid conversion: charged, and not given all of it back. */
export const paidOk = (u: FunnelUser) => has(u.paidAt) && !has(u.refundedAt);

function stage(
  key: StageKey,
  from: FunnelUser[],
  reached: (u: FunnelUser) => boolean,
  windowOver: (u: FunnelUser) => boolean,
): StageResult {
  const r: StageResult = { key, label: STAGE_LABELS[key], reached: [], dropped: [], pending: [], rate: null };
  for (const u of from) {
    if (reached(u)) r.reached.push(u);
    else if (windowOver(u)) r.dropped.push(u);
    else r.pending.push(u);
  }
  const decided = r.reached.length + r.dropped.length;
  r.rate = decided > 0 ? r.reached.length / decided : null;
  return r;
}

export function computeFunnel(users: FunnelUser[], range: FunnelRange, now = Date.now()): FunnelResult {
  const cohort = users.filter((u) => inCohort(u, range));
  const eligible = cohort.filter((u) => !u.excluded);
  const excluded = cohort.filter((u) => u.excluded);

  const day1 = stage("day1", eligible,
    (u) => has(u.day1At),
    (u) => now - t(u.signedUpAt) >= FUNNEL_WINDOWS.day1Ms);

  const card = stage("card", day1.reached,
    (u) => has(u.cardAt),
    (u) => now - t(u.day1At) >= FUNNEL_WINDOWS.cardMs);

  // A trial is decided once Stripe has either been paid or had its grace
  // period after the trial ended. A refunded first payment is decided too:
  // it is a no. Cancelling mid-trial is not decided until the trial runs out,
  // because the reader can still change their mind until then.
  const trialEnd = (u: FunnelUser) => (has(u.trialEndsAt) ? t(u.trialEndsAt) : t(u.cardAt) + TRIAL_MS);
  const paid = stage("paid", card.reached,
    paidOk,
    (u) => has(u.paidAt) || now >= trialEnd(u) + FUNNEL_WINDOWS.paidGraceMs);

  const book2 = stage("book2", paid.reached,
    (u) => has(u.secondBookAt),
    (u) => now - t(u.paidAt) >= FUNNEL_WINDOWS.book2Ms);

  const stages = [day1, card, paid, book2];

  // Overall: of the readers who activated, how many went all the way. Only
  // readers whose outcome is settled count: they reached Book 2, or they
  // dropped at some stage after its window closed.
  const droppedIds = new Set([card, paid, book2].flatMap((s) => s.dropped.map((u) => u.id)));
  const resolved = day1.reached.filter((u) => has(u.secondBookAt) || droppedIds.has(u.id)).length;
  const overall = {
    reached: book2.reached.length,
    resolved,
    rate: resolved > 0 ? book2.reached.length / resolved : null,
  };

  const gaps = book2.reached
    .filter((u) => has(u.firstBookAt))
    .map((u) => (t(u.secondBookAt) - t(u.firstBookAt)) / (24 * 3600_000))
    .sort((a, b) => a - b);
  const medianDaysToBook2 = gaps.length
    ? Math.round((gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2) * 10) / 10
    : null;

  const cardWithoutDay1 = eligible.filter((u) => has(u.cardAt) && !has(u.day1At));

  return { eligible, excluded, stages, overall, medianDaysToBook2, cardWithoutDay1 };
}

// ---- One Metric That Matters -------------------------------------------------

export type OmtmKey = "day1_activation" | "day1_to_card" | "trial_to_paid" | "second_book";

export const OMTM_OPTIONS: { key: OmtmKey; label: string; stage: StageKey }[] = [
  { key: "day1_activation", label: "Day 1 Activation Rate", stage: "day1" },
  { key: "day1_to_card", label: "Day 1 → Card Conversion", stage: "card" },
  { key: "trial_to_paid", label: "Trial → Paid Conversion", stage: "paid" },
  { key: "second_book", label: "Second Book Rate", stage: "book2" },
];

export const DEFAULT_OMTM: OmtmKey = "day1_to_card";

export function isOmtmKey(v: unknown): v is OmtmKey {
  return OMTM_OPTIONS.some((o) => o.key === v);
}

export interface MetricValue {
  numerator: number;
  denominator: number;
  rate: number | null;
  pending: number;
}

export function metricFor(result: FunnelResult, key: OmtmKey): MetricValue {
  const stageKey = OMTM_OPTIONS.find((o) => o.key === key)!.stage;
  const s = result.stages.find((x) => x.key === stageKey)!;
  return {
    numerator: s.reached.length,
    denominator: s.reached.length + s.dropped.length,
    rate: s.rate,
    pending: s.pending.length,
  };
}

/**
 * The equally long window just before this one, for "versus last period".
 * Null for an open-ended range: "all time" has nothing before it.
 */
export function previousRange(range: FunnelRange, now = Date.now()): FunnelRange | null {
  if (!range.from) return null;
  const from = t(range.from);
  const to = range.to ? t(range.to) : now;
  const len = to - from;
  if (!(len > 0)) return null;
  return {
    from: new Date(from - len).toISOString(),
    to: new Date(from).toISOString(),
    source: range.source,
  };
}

// ---- Creators ---------------------------------------------------------------

export interface CreatorRow {
  /** "" = arrived with no code. */
  source: string;
  sent: number;
  day1: number;
  card: number;
  paid: number;
  book2: number;
  rates: Record<StageKey, number | null>;
}

export function creatorBreakdown(users: FunnelUser[], range: Omit<FunnelRange, "source">, now = Date.now()): CreatorRow[] {
  const sources = new Set(users.filter((u) => !u.excluded && inCohort(u, range)).map((u) => u.source ?? ""));
  const rows: CreatorRow[] = [];
  for (const source of sources) {
    const f = computeFunnel(users, { ...range, source }, now);
    const [d1, c, p, b] = f.stages;
    rows.push({
      source,
      sent: f.eligible.length,
      day1: d1.reached.length,
      card: c.reached.length,
      paid: p.reached.length,
      book2: b.reached.length,
      rates: { day1: d1.rate, card: c.rate, paid: p.rate, book2: b.rate },
    });
  }
  // Creators who produce paying, returning readers first; traffic alone last.
  return rows.sort((a, b) => b.paid - a.paid || b.book2 - a.book2 || b.sent - a.sent || a.source.localeCompare(b.source));
}

// ---- Books ------------------------------------------------------------------

export interface GeneratedBook {
  id: string;
  title: string;
  author: string;
  /** When the course was saved to the shelf (or generated, for older records). */
  at: string;
}

/** The same book is the same book whatever the spacing or capitals. */
export const bookKey = (title: string, author: string) =>
  `${title.trim().toLowerCase().replace(/\s+/g, " ")}|${author.trim().toLowerCase().replace(/\s+/g, " ")}`;

/**
 * An account's first and second DISTINCT books, from the courses it actually
 * saved. Failed generations and retries never reach this list (they are never
 * saved), a saved course appears once however often its save is retried, and
 * generating the same book again does not count as a new one.
 */
export function distinctBooks(saved: GeneratedBook[]): GeneratedBook[] {
  const seen = new Set<string>();
  const out: GeneratedBook[] = [];
  const byTime = [...saved].filter((b) => has(b.at)).sort((a, b) => t(a.at) - t(b.at) || a.id.localeCompare(b.id));
  const ids = new Set<string>();
  for (const b of byTime) {
    if (ids.has(b.id)) continue;
    ids.add(b.id);
    const key = bookKey(b.title, b.author);
    if (!b.title.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

// ---- Attribution ------------------------------------------------------------

/** A creator code as stored: lowercase letters, digits, dash and underscore. */
export function cleanSourceCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return code || null;
}
