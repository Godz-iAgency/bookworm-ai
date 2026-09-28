import { planFromId } from "@/lib/plans";
import type { Metrics, AccountRow } from "../page";
import type { Detail } from "./DetailDialog";

/**
 * The breakdown behind each card on the Control Centre. Every number here is
 * computed from the same rows the card's headline came from, so the detail
 * always adds up to what the card says.
 */

const DAY = 24 * 3600_000;
const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "";
const email = (r: { email: string | null }) => r.email ?? "(no email)";
const price = (id: string) => Number(planFromId(id).price.replace(/[^0-9.]/g, ""));
const usd = (n: number) => `$${n.toFixed(2)}`;
const byNewest = (a: AccountRow, b: AccountRow) => b.createdAt.localeCompare(a.createdAt);

const TRIAL_STATUS: Record<string, string> = {
  active: "Running",
  converted: "Paid",
  expired: "Lapsed",
  cancelled: "Cancelled",
};

export function buildDetails(m: Metrics) {
  const now = Date.now();
  const seenWithin = (r: AccountRow, days: number) => !!r.lastSeenAt && now - Date.parse(r.lastSeenAt) <= days * DAY;
  // Book Club bills once per club, to its owner; members ride on that.
  const payers = m.accountRows.filter((r) => r.payingTier && (r.payingTier !== "book_club" || r.clubOwner));
  const payersTable = {
    columns: ["Email", "Plan", "Cancels on", "Payment"],
    rows: payers.map((r) => [email(r), r.plan, date(r.cancelAt) || "Renews", r.paymentFailed ? "Failed" : "OK"]),
    empty: "Nobody is paying yet.",
  };
  const coursesTable = {
    columns: ["Book", "Reader", "Days done", "Expires"],
    rows: m.courseRows.map((c) => [
      `${c.title}${c.author ? ` · ${c.author}` : ""}${c.shared ? " (shared)" : ""}`,
      c.email ?? "",
      `${c.daysDone} / 7`,
      date(c.expiresAt),
    ]),
    empty: "No books on shelves right now.",
  };

  return {
    revenue: (): Detail => {
      const s = m.subscriptions;
      const lines = [
        { name: "Page Turner", count: s.pageTurner, each: price("page_turner") },
        { name: "Well-Read", count: s.wellRead, each: price("well_read") },
        { name: "Book Club (per club)", count: s.bookClubs, each: price("book_club") },
      ];
      return {
        title: "Monthly revenue",
        intro: "What the current paying subscriptions add up to each month, at list price. Trials, complimentary accounts and Book Club members (who ride on their club owner's plan) are not counted.",
        sections: [
          {
            heading: "By plan",
            table: {
              columns: ["Plan", "Paying", "Price", "Per month"],
              rows: lines.map((l) => [l.name, l.count, usd(l.each), usd(l.count * l.each)]),
            },
          },
          { rows: [{ label: "Total per month", value: usd(s.mrr) }, { label: "A year at this rate", value: usd(s.arr) }, { label: "Cancelling at period end", value: s.cancelling }, { label: "Failed payments", value: s.paymentFailures }] },
          { heading: "Paying accounts", table: payersTable },
        ],
      };
    },

    accounts: (): Detail => {
      const byPlan = new Map<string, number>();
      for (const r of m.accountRows) byPlan.set(r.plan, (byPlan.get(r.plan) ?? 0) + 1);
      return {
        title: "Accounts",
        intro: "Every account that has signed up, from Firebase sign-in records.",
        sections: [
          {
            rows: [
              { label: "Total", value: m.totals.accounts },
              { label: "New today", value: m.totals.newToday },
              { label: "New in the last 7 days", value: m.totals.newThisWeek },
              { label: "New in the last 30 days", value: m.totals.newThisMonth },
            ],
          },
          { heading: "By plan right now", rows: [...byPlan.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })) },
          {
            heading: "All accounts",
            table: {
              columns: ["Email", "Joined", "Last seen", "Plan", "Books"],
              rows: [...m.accountRows].sort(byNewest).map((r) => [email(r), date(r.createdAt), date(r.lastSeenAt), r.plan, r.booksEver]),
            },
          },
        ],
      };
    },

    active: (): Detail => ({
      title: "Active readers",
      intro: "Accounts that signed in recently. A streak counts as alive if the reader did something yesterday or today.",
      sections: [
        {
          rows: [
            { label: "Active today", value: m.totals.activeToday },
            { label: "Active in the last 7 days", value: m.totals.activeThisWeek },
            { label: "Active in the last 30 days", value: m.totals.activeThisMonth },
            { label: "On a live streak", value: m.engagement.streaksActive },
          ],
        },
        {
          heading: "Active in the last 7 days",
          table: {
            columns: ["Email", "Last seen", "Streak", "Plan"],
            rows: m.accountRows
              .filter((r) => seenWithin(r, 7))
              .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
              .map((r) => [email(r), date(r.lastSeenAt), r.streakAlive ? `${r.streak} days` : "None", r.plan]),
            empty: "Nobody signed in this week.",
          },
        },
      ],
    }),

    books: (): Detail => ({
      title: "Books generated",
      intro: "The headline is books generated this billing month, across every account. All-time counts only different books each reader saved to their shelf.",
      sections: [
        {
          rows: [
            { label: "Generated this month", value: m.engagement.booksThisMonth },
            { label: "Different books saved, all time", value: m.accountRows.reduce((n, r) => n + r.booksEver, 0) },
            { label: "On shelves now", value: m.engagement.coursesActive },
            { label: "Shared in Book Clubs", value: m.subscriptions.sharedBooks },
          ],
        },
        {
          heading: "By reader",
          table: {
            columns: ["Email", "This month", "All time", "Finished"],
            rows: m.accountRows
              .filter((r) => r.booksThisMonth > 0 || r.booksEver > 0)
              .sort((a, b) => b.booksThisMonth - a.booksThisMonth || b.booksEver - a.booksEver)
              .map((r) => [email(r), r.booksThisMonth, r.booksEver, r.finished]),
            empty: "No books generated yet.",
          },
        },
        { heading: "On shelves now", table: coursesTable },
      ],
    }),

    subscriptions: (): Detail => ({
      title: "Subscriptions",
      intro: "Paid plans right now. Book Clubs are billed to the owner; the other seats are free.",
      sections: [
        {
          rows: [
            { label: "Page Turner", value: m.subscriptions.pageTurner },
            { label: "Well-Read", value: m.subscriptions.wellRead },
            { label: "Book Clubs", value: m.subscriptions.bookClubs },
            { label: "Club seats filled", value: `${m.subscriptions.seatsUsed} / ${m.subscriptions.seatsTotal || 0}` },
            { label: "Complimentary accounts", value: m.totals.comped },
          ],
        },
        { heading: "Paying accounts", table: payersTable },
        {
          heading: "Book Clubs",
          table: {
            columns: ["Owner", "Members"],
            rows: m.clubRows.map((c) => [c.owner ?? "(unknown)", c.members.join(", ")]),
            empty: "No active clubs.",
          },
        },
        {
          heading: "Complimentary accounts",
          table: {
            columns: ["Email", "Access", "Joined"],
            rows: m.accountRows.filter((r) => r.complimentary).map((r) => [email(r), r.plan, date(r.createdAt)]),
            empty: "None.",
          },
        },
      ],
    }),

    trials: (): Detail => ({
      title: "Trials",
      intro: "Every account that has started the 7-day trial, with where it ended up. The rate here is converted over converted plus lapsed; the core funnel above uses Stripe's paid invoices instead.",
      sections: [
        {
          rows: [
            { label: "Running now", value: m.trials.active },
            { label: "Converted to paid", value: m.trials.converted },
            { label: "Lapsed or cancelled", value: m.trials.lapsed },
            { label: "Conversion rate", value: m.trials.conversionRate === null ? "n/a" : `${m.trials.conversionRate}%` },
          ],
        },
        {
          heading: "Trial accounts",
          table: {
            columns: ["Email", "Status", "Started", "Ends", "Cancelling"],
            rows: m.accountRows
              .filter((r) => r.trialStartedAt || r.trialStatus)
              .sort((a, b) => (b.trialStartedAt ?? "").localeCompare(a.trialStartedAt ?? ""))
              .map((r) => [
                email(r),
                TRIAL_STATUS[r.trialStatus ?? ""] ?? (r.trialStatus || "Unknown"),
                date(r.trialStartedAt),
                date(r.trialEndsAt),
                r.cancelAt ? `On ${date(r.cancelAt)}` : "No",
              ]),
            empty: "No trials yet.",
          },
        },
      ],
    }),

    reading: (): Detail => ({
      title: "Reading",
      intro: "Books currently on shelves (expired ones are left out), and how far each reader has got.",
      sections: [
        {
          rows: [
            { label: "Courses on shelves", value: m.engagement.coursesActive },
            { label: "Finished (all 7 days)", value: m.engagement.coursesComplete },
            { label: "Completion rate", value: `${m.engagement.completionRate}%` },
            { label: "Average days done per book", value: m.engagement.avgDaysPerCourse },
            { label: "Expiring in 48 hours", value: m.engagement.coursesExpiringSoon },
            { label: "Books finished, all time", value: m.engagement.booksFinishedTotal },
          ],
        },
        { heading: "On shelves now", table: coursesTable },
      ],
    }),

    step: (key: "signedUp" | "onboarded" | "generated" | "finished"): Detail => {
      const meta = {
        signedUp: { title: "Signed up", intro: "Every account.", keep: (_: AccountRow) => true },
        onboarded: { title: "Finished onboarding", intro: "Accounts that picked a reading level.", keep: (r: AccountRow) => r.onboarded },
        generated: { title: "Generated a book", intro: "Accounts that generated at least one book this billing month.", keep: (r: AccountRow) => r.booksThisMonth > 0 },
        finished: { title: "Finished a book", intro: "Accounts that have finished all 7 days of at least one book.", keep: (r: AccountRow) => r.finished > 0 },
      }[key];
      const inStep = m.accountRows.filter(meta.keep).sort(byNewest);
      return {
        title: meta.title,
        intro: meta.intro,
        sections: [
          {
            rows: [
              { label: "Accounts", value: inStep.length },
              { label: "Share of all sign-ups", value: m.accountRows.length ? `${Math.round((inStep.length / m.accountRows.length) * 100)}%` : "n/a" },
            ],
          },
          {
            heading: "Accounts",
            table: {
              columns: ["Email", "Joined", "Plan", "Books", "Finished"],
              rows: inStep.map((r) => [email(r), date(r.createdAt), r.plan, r.booksEver, r.finished]),
            },
          },
        ],
      };
    },
  };
}
