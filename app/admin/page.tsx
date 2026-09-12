"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Users, TrendingUp, BookOpen, Flame, AlertTriangle, Link2, Copy, LogOut, RefreshCw,
  CreditCard, ExternalLink, Undo2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { isAdminEmail } from "@/lib/admin";
import type { AccessLink } from "@/lib/access";
import type { AdminCharge } from "@/app/api/admin/payments/route";

interface Payments {
  charges: AdminCharge[];
  summary: { grossCents: number; refundedCents: number; netCents: number; count: number; disputes: number };
}

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

interface Metrics {
  totals: {
    accounts: number; newToday: number; newThisWeek: number; newThisMonth: number;
    activeToday: number; activeThisWeek: number; activeThisMonth: number;
    comped: number; pendingDeletion: number;
  };
  signupsByDay: { date: string; count: number }[];
  subscriptions: {
    pageTurner: number; wellRead: number; bookClubMembers: number; bookClubs: number;
    seatsUsed: number; seatsTotal: number; sharedBooks: number;
    mrr: number; arr: number; cancelling: number; paymentFailures: number;
  };
  trials: { active: number; converted: number; lapsed: number; conversionRate: number | null };
  funnel: { signedUp: number; onboarded: number; generated: number; finished: number };
  engagement: {
    booksThisMonth: number; booksFinishedTotal: number; streaksActive: number;
    coursesActive: number; coursesShared: number; coursesComplete: number; coursesExpiringSoon: number;
    avgDaysPerCourse: number; completionRate: number; coursesReadable: boolean;
  };
  library: {
    topBooks: { title: string; author: string; count: number }[];
    topTopics: { name: string; count: number }[];
    readingLevels: Record<string, number>;
  };
  recent: {
    email: string | null; createdAt: string; lastSeenAt: string | null;
    plan: string; books: number; finished: number; streak: number;
  }[];
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/**
 * The control centre. One account reaches it — see lib/admin.ts — and that
 * account only ever sees this, never the reading app.
 *
 * The gate here is for routing and for not rendering an empty shell to the
 * wrong person; the gate that actually matters is on the API routes, which
 * check the email on a verified Firebase token before answering with anything.
 */
export default function AdminPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [links, setLinks] = useState<AccessLink[] | null>(null);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // A refund is real money leaving the business and Stripe will not take it
  // back, so the button arms first and commits second.
  const [confirmRefund, setConfirmRefund] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [refundNote, setRefundNote] = useState<string | null>(null);

  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Anyone else who finds this URL goes back to the app they actually have.
    if (!isAdmin) router.replace("/dashboard");
  }, [loading, user, isAdmin, router]);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [m, l, p] = await Promise.all([
      postAuthed<Metrics & { error?: string }>("/api/admin/metrics"),
      postAuthed<{ links: AccessLink[]; error?: string }>("/api/admin/links", { action: "list" }),
      postAuthed<Payments & { error?: string }>("/api/admin/payments", { action: "list" }),
    ]);
    setRefreshing(false);
    if ("error" in m && m.error) setError(m.error);
    else { setMetrics(m); setError(null); }
    if (!("error" in l && l.error)) setLinks(l.links);
    // Stripe being unconfigured or unreachable is its own problem, shown in
    // its own panel — it must not blank out the rest of the dashboard.
    if ("error" in p && p.error) setPaymentsError(p.error);
    else { setPayments(p); setPaymentsError(null); }
  }, []);

  const refund = async (chargeId: string) => {
    setRefunding(chargeId);
    setRefundNote(null);
    const res = await postAuthed<{ amount: number; currency: string; error?: string }>(
      "/api/admin/payments",
      { action: "refund", chargeId },
    );
    setRefunding(null);
    setConfirmRefund(null);
    if (res.error) { setPaymentsError(res.error); return; }
    setRefundNote(`Refunded ${money(res.amount, res.currency)}.`);
    const p = await postAuthed<Payments & { error?: string }>("/api/admin/payments", { action: "list" });
    if (!("error" in p && p.error)) setPayments(p);
  };

  useEffect(() => {
    if (!loading && user && isAdmin) void load();
  }, [loading, user, isAdmin, load]);

  const toggleLink = async (token: string, active: boolean) => {
    setBusyToken(token);
    const res = await postAuthed<{ links: AccessLink[]; error?: string }>("/api/admin/links", {
      action: "toggle", token, active,
    });
    setBusyToken(null);
    if (res.error) { setError(res.error); return; }
    setLinks(res.links);
  };

  const copy = async (text: string, token: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
  };

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[#0a0a0a] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  const m = metrics;
  const peakSignups = m ? Math.max(1, ...m.signupsByDay.map((d) => d.count)) : 1;

  return (
    <div className="min-h-dvh w-full bg-[#0a0a0a] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 pb-16">
        <div className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo variant="mark" size={30} alt="" className="opacity-80" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Control Centre</h1>
              <p className="text-xs text-white/45">{user.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2} />
              Refresh
            </button>
            <button
              onClick={() => logout().then(() => router.replace("/login"))}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}

        {!m ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-[#00D4FF]" />
          </div>
        ) : (
          <>
            {/* Headline numbers */}
            <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={TrendingUp} label="Monthly revenue" value={`$${m.subscriptions.mrr.toFixed(2)}`}
                sub={`$${m.subscriptions.arr.toFixed(0)} a year at this rate`} accent />
              <Stat icon={Users} label="Accounts" value={m.totals.accounts}
                sub={`+${m.totals.newThisWeek} this week · +${m.totals.newToday} today`} />
              <Stat icon={Flame} label="Active readers" value={m.totals.activeThisWeek}
                sub={`${m.totals.activeToday} today · ${m.engagement.streaksActive} on a streak`} />
              <Stat icon={BookOpen} label="Books generated" value={m.engagement.booksThisMonth}
                sub={`${m.engagement.coursesActive} on shelves now`} />
            </div>

            {/* Anything that wants attention today */}
            {(m.subscriptions.paymentFailures > 0 || m.subscriptions.cancelling > 0 || m.totals.pendingDeletion > 0) && (
              <div className="mb-6 flex flex-wrap gap-2">
                {m.subscriptions.paymentFailures > 0 && (
                  <Alert text={`${m.subscriptions.paymentFailures} failed payment${m.subscriptions.paymentFailures === 1 ? "" : "s"}`} />
                )}
                {m.subscriptions.cancelling > 0 && (
                  <Alert text={`${m.subscriptions.cancelling} cancelling at period end`} />
                )}
                {m.totals.pendingDeletion > 0 && (
                  <Alert text={`${m.totals.pendingDeletion} account${m.totals.pendingDeletion === 1 ? "" : "s"} pending deletion`} />
                )}
              </div>
            )}

            {/* Sign-ups, last 14 days */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Sign-ups · last 14 days</h2>
                <span className="text-xs text-white/45">{m.totals.newThisMonth} in 30 days</span>
              </div>
              {/* Each column is h-full so the bar's percentage has a definite
                  height to resolve against — inside an auto-height column a
                  percentage height computes to zero and the chart renders as
                  an empty strip with only its labels showing. */}
              <div className="flex h-28 gap-1.5">
                {m.signupsByDay.map((d) => (
                  <div key={d.date} className="group flex h-full flex-1 flex-col justify-end gap-1">
                    <div
                      className="w-full shrink-0 rounded-t bg-gradient-to-t from-[#00D4FF] to-[#FF006E] transition-opacity group-hover:opacity-80"
                      style={{ height: `${Math.max(4, (d.count / peakSignups) * 100)}%` }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <span className="shrink-0 text-center text-[9px] tabular-nums text-white/35">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Panel title="Subscriptions">
                <Row label="Page Turner · $9.99" value={m.subscriptions.pageTurner} />
                <Row label="Well-Read · $19.99" value={m.subscriptions.wellRead} />
                <Row label="Book Clubs · $34.99" value={m.subscriptions.bookClubs} />
                <Row label="Club seats filled" value={`${m.subscriptions.seatsUsed} / ${m.subscriptions.seatsTotal || 0}`} />
                <Row label="Books shared in clubs" value={m.subscriptions.sharedBooks} />
                <Row label="Complimentary accounts" value={m.totals.comped} />
              </Panel>

              <Panel title="Trials">
                <Row label="Running now" value={m.trials.active} />
                <Row label="Converted to paid" value={m.trials.converted} />
                <Row label="Lapsed" value={m.trials.lapsed} />
                <Row label="Conversion rate"
                  value={m.trials.conversionRate === null ? "—" : `${m.trials.conversionRate}%`} />
              </Panel>

              <Panel title="Reading">
                <Row label="Courses on shelves" value={m.engagement.coursesActive} />
                <Row label="Finished (all 7 days)" value={m.engagement.coursesComplete} />
                <Row label="Completion rate" value={`${m.engagement.completionRate}%`} />
                <Row label="Avg days done per book" value={m.engagement.avgDaysPerCourse} />
                <Row label="Expiring in 48h" value={m.engagement.coursesExpiringSoon} />
                <Row label="Books finished, all time" value={m.engagement.booksFinishedTotal} />
              </Panel>
            </div>

            {/* Funnel */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/60">Funnel</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                <FunnelStep label="Signed up" value={m.funnel.signedUp} of={m.funnel.signedUp} />
                <FunnelStep label="Finished onboarding" value={m.funnel.onboarded} of={m.funnel.signedUp} />
                <FunnelStep label="Generated a book" value={m.funnel.generated} of={m.funnel.signedUp} />
                <FunnelStep label="Finished a book" value={m.funnel.finished} of={m.funnel.signedUp} />
              </div>
            </div>

            <div className="mb-6 grid gap-3 md:grid-cols-2">
              <Panel title="Most-read books">
                {m.library.topBooks.length === 0 ? (
                  <p className="text-sm text-white/45">
                    {m.engagement.coursesReadable ? "No books on shelves yet." : "Course data unavailable."}
                  </p>
                ) : (
                  m.library.topBooks.map((b) => (
                    <Row key={b.title} label={`${b.title}${b.author ? ` · ${b.author}` : ""}`} value={b.count} />
                  ))
                )}
              </Panel>

              <Panel title="Most-picked topics">
                {m.library.topTopics.length === 0 ? (
                  <p className="text-sm text-white/45">No topics chosen yet.</p>
                ) : (
                  m.library.topTopics.map((t) => <Row key={t.name} label={t.name} value={t.count} />)
                )}
              </Panel>
            </div>

            {/* Payments — what Stripe actually charged, and the way back. */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-5">
              <div className="mb-1 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#00D4FF]" strokeWidth={2} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Payments</h2>
                {payments && (
                  <span className="ml-auto text-xs text-white/45">
                    {money(payments.summary.netCents)} net · {money(payments.summary.grossCents)} charged
                    {payments.summary.refundedCents > 0 && ` · ${money(payments.summary.refundedCents)} refunded`}
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs text-white/45">
                The last 50 charges, straight from Stripe. Refunds return the full remaining amount and can&rsquo;t be undone.
              </p>

              {refundNote && (
                <div className="mb-3 rounded-lg border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-2.5 text-sm text-[#00D4FF]">
                  {refundNote}
                </div>
              )}
              {paymentsError && (
                <div className="mb-3 rounded-lg border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-2.5 text-sm text-[#FFB020]">
                  {paymentsError}
                </div>
              )}

              {!payments ? (
                paymentsError ? null : <Loader2 className="h-5 w-5 animate-spin text-white/40" />
              ) : payments.charges.length === 0 ? (
                <p className="text-sm text-white/50">No charges yet.</p>
              ) : (
                <ul className="space-y-2">
                  {payments.charges.map((c) => {
                    const remaining = c.amount - c.amountRefunded;
                    const fullyRefunded = remaining <= 0;
                    const arming = confirmRefund === c.id;
                    return (
                      <li key={c.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="text-sm font-bold tabular-nums">{money(c.amount, c.currency)}</span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-white/65">
                            {c.customerEmail ?? c.customerId ?? "Unknown customer"}
                          </span>
                          <span className="text-[11px] text-white/40">
                            {new Date(c.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {c.disputed && (
                            <span className="rounded-full border border-[#FF006E]/50 bg-[#FF006E]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF006E]">
                              Disputed
                            </span>
                          )}
                          {fullyRefunded ? (
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/40">
                              Refunded
                            </span>
                          ) : c.amountRefunded > 0 ? (
                            <span className="rounded-full border border-[#FFB020]/40 bg-[#FFB020]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FFB020]">
                              {money(c.amountRefunded, c.currency)} back
                            </span>
                          ) : c.status !== "succeeded" ? (
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/40">
                              {c.status}
                            </span>
                          ) : null}

                          {c.receiptUrl && (
                            <a
                              href={c.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-full border border-white/15 p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                              aria-label="Open the Stripe receipt"
                            >
                              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                            </a>
                          )}

                          {!fullyRefunded && c.status === "succeeded" && !arming && (
                            <button
                              onClick={() => { setConfirmRefund(c.id); setRefundNote(null); }}
                              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-[#FF006E]/50 hover:bg-[#FF006E]/10 hover:text-[#FF006E]"
                            >
                              <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
                              Refund
                            </button>
                          )}
                        </div>

                        {arming && (
                          <div className="mt-2.5 rounded-lg border border-[#FF006E]/40 bg-[#FF006E]/10 p-3">
                            <p className="text-[13px] leading-relaxed text-white/85">
                              Refund <span className="font-bold">{money(remaining, c.currency)}</span> to{" "}
                              <span className="font-bold">{c.customerEmail ?? "this customer"}</span>? The money goes
                              back to their card and this can&rsquo;t be reversed.
                            </p>
                            <div className="mt-2.5 flex gap-2">
                              <button
                                onClick={() => setConfirmRefund(null)}
                                disabled={refunding === c.id}
                                className="flex-1 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-white/80 disabled:opacity-60"
                              >
                                Never mind
                              </button>
                              <button
                                onClick={() => refund(c.id)}
                                disabled={refunding === c.id}
                                className="flex-1 rounded-lg bg-[#FF006E] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#FF006E]/85 disabled:opacity-60"
                              >
                                {refunding === c.id ? "Refunding…" : `Refund ${money(remaining, c.currency)}`}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Demo links — share one, switch it off when it has done its job. */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-5">
              <div className="mb-1 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-[#00D4FF]" strokeWidth={2} />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Demo links</h2>
              </div>
              <p className="mb-4 text-xs text-white/45">
                Anyone with one of these taps straight into the app — no signup, no card. Switch one off and it stops working immediately, including for anyone already signed in through it.
              </p>

              {!links ? (
                <Loader2 className="h-5 w-5 animate-spin text-white/40" />
              ) : links.length === 0 ? (
                <p className="text-sm text-white/50">No links yet.</p>
              ) : (
                <ul className="space-y-3">
                  {links.map((link) => {
                    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/go/${link.token}`;
                    return (
                      <li key={link.token} className="rounded-xl border border-white/10 bg-black/30 p-3.5">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">{link.label}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            link.active
                              ? "border-[#00D4FF]/40 bg-[#00D4FF]/10 text-[#00D4FF]"
                              : "border-white/15 text-white/40"
                          }`}>
                            {link.active ? "On" : "Off"}
                          </span>
                          <span className="ml-auto text-[11px] text-white/40">
                            {link.bookLimit === null
                              ? `${link.booksUsed} books · no limit`
                              : `${link.booksUsed} / ${link.bookLimit} books used`}
                            {" · "}
                            {link.useCount} {link.useCount === 1 ? "open" : "opens"}
                            {link.lastUsedAt ? ` · last ${shortDate(link.lastUsedAt)}` : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs text-white/75">
                            {url}
                          </code>
                          <button
                            onClick={() => copy(url, link.token)}
                            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                          >
                            <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                            {copied === link.token ? "Copied" : "Copy"}
                          </button>
                          <button
                            onClick={() => toggleLink(link.token, !link.active)}
                            disabled={busyToken === link.token}
                            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                              link.active
                                ? "border border-[#FF006E]/50 bg-[#FF006E]/10 text-[#FF006E] hover:bg-[#FF006E]/20"
                                : "bg-gradient-to-r from-[#00D4FF] to-[#FF006E] text-white hover:scale-[1.02]"
                            }`}
                          >
                            {busyToken === link.token ? "…" : link.active ? "Turn off" : "Turn on"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">Newest accounts</h2>
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-white/40">
                      <th className="px-1 pb-2 font-bold">Email</th>
                      <th className="px-1 pb-2 font-bold">Joined</th>
                      <th className="px-1 pb-2 font-bold">Last seen</th>
                      <th className="px-1 pb-2 font-bold">Plan</th>
                      <th className="px-1 pb-2 text-right font-bold">Books</th>
                      <th className="px-1 pb-2 text-right font-bold">Done</th>
                      <th className="px-1 pb-2 text-right font-bold">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.recent.map((r, i) => (
                      <tr key={`${r.email}-${i}`} className="border-t border-white/5">
                        <td className="max-w-[220px] truncate px-1 py-2.5 text-white/85">{r.email ?? "—"}</td>
                        <td className="px-1 py-2.5 text-white/55">{shortDate(r.createdAt)}</td>
                        <td className="px-1 py-2.5 text-white/55">{shortDate(r.lastSeenAt)}</td>
                        <td className="px-1 py-2.5 text-white/70">{r.plan}</td>
                        <td className="px-1 py-2.5 text-right tabular-nums text-white/70">{r.books}</td>
                        <td className="px-1 py-2.5 text-right tabular-nums text-white/70">{r.finished}</td>
                        <td className="px-1 py-2.5 text-right tabular-nums text-white/70">{r.streak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Users; label: string; value: string | number; sub?: string; accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={accent ? {
        border: "1.5px solid transparent",
        background: "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box",
      } : { border: "1px solid rgba(255,255,255,0.10)", background: "#111" }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-[#00D4FF]" strokeWidth={2} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</span>
      </div>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/45">{sub}</p>}
    </div>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#FFB020]/40 bg-[#FFB020]/10 px-3.5 py-1.5 text-xs font-semibold text-[#FFB020]">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {text}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/60">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="min-w-0 truncate text-[13px] text-white/60">{label}</span>
      <span className="shrink-0 text-sm font-bold tabular-nums text-white/90">{value}</span>
    </div>
  );
}

function FunnelStep({ label, value, of }: { label: string; value: number; of: number }) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0;
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black">
        <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#FF006E]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-white/40">{pct}% of sign-ups</p>
    </div>
  );
}
