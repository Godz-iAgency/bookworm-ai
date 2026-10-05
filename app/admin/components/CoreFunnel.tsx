"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Target, ArrowRight, ArrowDown } from "lucide-react";
import {
  computeFunnel, creatorBreakdown, metricFor, previousRange,
  OMTM_OPTIONS, FUNNEL_WINDOWS, type FunnelRange, type FunnelUser, type OmtmKey, type StageKey,
} from "@/lib/funnel";
import type { Detail } from "./DetailDialog";

/** When live Day 1 tracking shipped. Earlier Day 1 reads are reconstructed. */
export const DAY1_TRACKING_SINCE = "Sep 27, 2026";

type Preset = "today" | "7d" | "30d" | "all" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom" },
];

const DAY = 24 * 3600_000;

const pct = (rate: number | null) => (rate === null ? "n/a" : `${Math.round(rate * 100)}%`);
const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "";
const sourceLabel = (s: string | null) => (s ? s : "Direct / no code");

/** Local-midnight ISO for a yyyy-mm-dd input value. */
const midnight = (ymd: string, addDays = 0) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d + addDays).toISOString();
};

function rangeFor(preset: Preset, customFrom: string, customTo: string, now: number): FunnelRange {
  if (preset === "today") {
    const d = new Date(now);
    return { from: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString() };
  }
  if (preset === "7d") return { from: new Date(now - 7 * DAY).toISOString() };
  if (preset === "30d") return { from: new Date(now - 30 * DAY).toISOString() };
  if (preset === "custom" && customFrom) {
    return { from: midnight(customFrom), to: customTo ? midnight(customTo, 1) : undefined };
  }
  return {};
}

/** What each stage's own date is, for its detail table. */
const STAGE_DATE: Record<StageKey, { column: string; get: (u: FunnelUser) => string | null }> = {
  day1: { column: "Read Day 1", get: (u) => u.day1At },
  card: { column: "Card added", get: (u) => u.cardAt },
  paid: { column: "Paid", get: (u) => u.paidAt },
  book2: { column: "Book 2", get: (u) => u.secondBookAt },
};

const STAGE_PREV_LABEL: Record<StageKey, string> = {
  day1: "of eligible new users",
  card: "of Day 1 readers",
  paid: "of card-qualified trials",
  book2: "of paid readers",
};

const STAGE_WINDOW_NOTE: Record<StageKey, string> = {
  day1: "Counted once a reader has had Day 1 open for 15 seconds. New users get 24 hours before a miss counts.",
  card: "A saved card plus a started 7-day trial, which is what unlocks Days 2 to 7. Readers get 48 hours after Day 1 before a miss counts.",
  paid: "Stripe's first paid invoice above $0. A fully refunded first payment does not count. Trials are only judged 3 days after they end, so Stripe's retries can finish.",
  book2: "A second, different book saved to the shelf. Retries, failed generations and the same book again never count. Paid readers get 30 days before a miss counts.",
};

export function CoreFunnel({
  users, omtm, onOmtmChange, onOpen,
}: {
  users: FunnelUser[];
  omtm: OmtmKey;
  onOmtmChange: (key: OmtmKey) => void;
  onOpen: (detail: Detail) => void;
}) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [source, setSource] = useState<string | undefined>(undefined);

  // "Now" moves with each refresh of the data, not with every re-render, so
  // pending readers do not tick over to missed while you are reading the page.
  const now = useMemo(() => (users ? Date.now() : 0), [users]);
  const baseRange = rangeFor(preset, customFrom, customTo, now);
  const range: FunnelRange = { ...baseRange, source };
  // Plain recomputation: a few passes over one row per account.
  const result = computeFunnel(users, range, now);
  const prevRange = previousRange(range, now);
  const prev = prevRange ? computeFunnel(users, prevRange, now) : null;
  const creators = creatorBreakdown(users, baseRange, now);
  const sources = useMemo(
    () => [...new Set(users.filter((u) => u.source).map((u) => u.source as string))].sort(),
    [users],
  );

  const current = metricFor(result, omtm);
  const before = prev ? metricFor(prev, omtm) : null;
  const delta = current.rate !== null && before?.rate != null ? Math.round((current.rate - before.rate) * 100) : null;
  const omtmLabel = OMTM_OPTIONS.find((o) => o.key === omtm)!.label;
  const presetLabel = PRESETS.find((p) => p.key === preset)!.label;
  const reconstructed = result.stages[0].reached.filter((u) => u.day1Via === "reconstructed").length;

  const userRow = (u: FunnelUser, k: StageKey) => [
    u.email ?? "(no email)",
    date(u.signedUpAt),
    date(STAGE_DATE[k].get(u)) || "",
    sourceLabel(u.source),
    [u.readingLevel, u.language].filter(Boolean).join(" · "),
  ];

  const openStage = (i: number) => {
    const s = result.stages[i];
    const cols = ["Email", "Signed up", STAGE_DATE[s.key].column, "Source", "Mode · language"];
    const decided = s.reached.length + s.dropped.length;
    onOpen({
      title: s.label,
      intro: STAGE_WINDOW_NOTE[s.key],
      sections: [
        {
          rows: [
            { label: "Reached this stage", value: s.reached.length },
            { label: "Did not, after their full window", value: s.dropped.length },
            { label: "Still inside their window", value: s.pending.length },
            { label: `Rate (${s.reached.length} of ${decided} decided)`, value: pct(s.rate) },
            ...(s.key === "day1" && reconstructed > 0
              ? [{ label: `Counted from a completed Day 1 (before ${DAY1_TRACKING_SINCE})`, value: reconstructed }]
              : []),
            ...(s.key === "paid"
              ? [{ label: "First payment refunded in full", value: s.dropped.filter((u) => u.refundedAt).length }]
              : []),
          ],
        },
        { heading: "Reached", table: { columns: cols, rows: s.reached.map((u) => userRow(u, s.key)) } },
        { heading: "Did not reach it", table: { columns: cols, rows: s.dropped.map((u) => userRow(u, s.key)), empty: "Nobody has dropped here." } },
        { heading: "Still in their window", table: { columns: cols, rows: s.pending.map((u) => userRow(u, s.key)), empty: "Nobody is waiting." } },
        ...(s.key === "book2" ? [{
          heading: "Book 1 and Book 2",
          table: {
            columns: ["Email", "Book 1", "Book 2", "Days between"],
            rows: s.reached.map((u) => [
              u.email ?? "(no email)",
              u.firstBookTitle ?? "",
              u.secondBookTitle ?? "",
              u.firstBookAt && u.secondBookAt
                ? Math.round(((Date.parse(u.secondBookAt) - Date.parse(u.firstBookAt)) / DAY) * 10) / 10
                : "",
            ]),
          },
        }] : []),
      ],
    });
  };

  const openExtras = () => {
    onOpen({
      title: "Who is in this funnel",
      intro: "The funnel measures new readers going through the free Day 1 and the 7-day trial. These accounts signed up in this range but never go through it.",
      sections: [
        {
          heading: "Left out of the funnel",
          table: {
            columns: ["Email", "Signed up", "Why"],
            rows: result.excluded.map((u) => [
              u.email ?? "(no email)",
              date(u.signedUpAt),
              u.excluded === "admin" ? "Your own account" : u.excluded === "complimentary" ? "Complimentary access" : "Book Club member",
            ]),
            empty: "Nobody left out.",
          },
        },
        {
          heading: "Added a card with no Day 1 read recorded",
          note: "They skipped straight to the card, or read Day 1 before live tracking began without marking it complete. Not counted in stage 2.",
          table: {
            columns: ["Email", "Signed up", "Card added"],
            rows: result.cardWithoutDay1.map((u) => [u.email ?? "(no email)", date(u.signedUpAt), date(u.cardAt)]),
            empty: "None.",
          },
        },
      ],
    });
  };

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-[#111] p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-sm font-bold uppercase tracking-wider text-white/60">Bookworm core funnel</h2>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold transition-colors ${
                preset === p.key ? "bg-white text-black" : "border border-white/15 text-white/65 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={source ?? "__all"}
          onChange={(e) => setSource(e.target.value === "__all" ? undefined : e.target.value)}
          className="rounded-full border border-white/15 bg-[#111] px-3 py-1.5 text-[0.6875rem] font-semibold text-white/80"
          aria-label="Filter by creator"
        >
          <option value="__all">All sources</option>
          <option value="">Direct / no code</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {preset === "custom" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <label className="flex items-center gap-1.5">From
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-white [color-scheme:dark]" />
          </label>
          <label className="flex items-center gap-1.5">To
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-white [color-scheme:dark]" />
          </label>
          {!customFrom && <span className="text-white/40">Pick a start date. Until then this shows all time.</span>}
        </div>
      )}

      {/* OMTM */}
      <div
        className="mb-5 rounded-xl p-4"
        style={{ border: "1.5px solid transparent", background: "linear-gradient(#0d0d0d,#0d0d0d) padding-box, linear-gradient(135deg,#00D4FF,#FF006E) border-box" }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Target className="h-4 w-4 text-[#FF006E]" strokeWidth={2} />
          <span className="text-[0.625rem] font-bold uppercase tracking-wide text-white/50">One metric that matters</span>
          <select
            value={omtm}
            onChange={(e) => onOmtmChange(e.target.value as OmtmKey)}
            className="ml-auto rounded-full border border-white/15 bg-[#0d0d0d] px-3 py-1 text-[0.6875rem] font-semibold text-white/80"
            aria-label="Choose your one metric that matters"
          >
            {OMTM_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <p className="text-sm font-semibold text-white/85">{omtmLabel}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-4xl font-black tabular-nums">{pct(current.rate)}</span>
          <span className="text-sm text-white/60">
            {current.numerator} of {current.denominator}
            {current.pending > 0 && <span className="text-white/40"> · {current.pending} still in their window</span>}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-white/50">
          {!prev
            ? "No earlier period to compare with for this range."
            : delta === null
              ? "Not enough decided readers in one of the two periods to compare yet."
              : `${delta > 0 ? "+" : ""}${delta} pts versus the previous ${presetLabel === "Custom" ? "period of the same length" : presetLabel.replace("Last ", "").toLowerCase()} (${pct(before!.rate)}, ${before!.numerator} of ${before!.denominator}).`}
        </p>
        <p className="mt-1 text-[0.6875rem] text-white/35">You choose this metric. It never changes on its own.</p>
      </div>

      {/* The four stages */}
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
        {result.stages.map((s, i) => (
          <div key={s.key} className="contents">
            {i > 0 && (
              <div className="flex items-center justify-center text-white/25">
                <ArrowDown className="h-4 w-4 md:hidden" /><ArrowRight className="hidden h-4 w-4 md:block" />
              </div>
            )}
            <button
              onClick={() => openStage(i)}
              className="group rounded-xl border border-white/10 bg-black/30 p-3.5 text-left transition-colors hover:border-[#00D4FF]/40 hover:bg-[#00D4FF]/[0.04]"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.625rem] font-bold uppercase tracking-wide text-white/45">{s.label}</p>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition-colors group-hover:text-[#00D4FF]" />
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums">{s.reached.length}</p>
              <p className="text-[0.6875rem] text-white/55">
                <span className="font-bold text-white/85">{pct(s.rate)}</span> {STAGE_PREV_LABEL[s.key]}
              </p>
              <p className="mt-0.5 text-[0.625rem] text-white/35">
                {s.reached.length + s.dropped.length} decided{s.pending.length ? ` · ${s.pending.length} pending` : ""}
              </p>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-[0.8125rem] sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5">
          <p className="text-[0.625rem] font-bold uppercase tracking-wide text-white/45">Day 1 → second book, overall</p>
          <p className="mt-0.5 font-bold tabular-nums">
            {pct(result.overall.rate)} <span className="font-normal text-white/50">({result.overall.reached} of {result.overall.resolved} settled)</span>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5">
          <p className="text-[0.625rem] font-bold uppercase tracking-wide text-white/45">Median time, book 1 → book 2</p>
          <p className="mt-0.5 font-bold tabular-nums">
            {result.medianDaysToBook2 === null ? <span className="font-normal text-white/50">Not enough data yet</span> : `${result.medianDaysToBook2} days`}
          </p>
        </div>
        <button
          onClick={openExtras}
          className="group rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-left transition-colors hover:border-[#00D4FF]/40"
        >
          <p className="flex items-center justify-between text-[0.625rem] font-bold uppercase tracking-wide text-white/45">
            Cohort <ChevronRight className="h-3.5 w-3.5 text-white/25 group-hover:text-[#00D4FF]" />
          </p>
          <p className="mt-0.5 text-white/70">
            <span className="font-bold text-white">{result.eligible.length}</span> new readers
            {result.excluded.length > 0 && <span className="text-white/45"> · {result.excluded.length} left out</span>}
          </p>
        </button>
      </div>

      <p className="mt-3 text-[0.6875rem] leading-relaxed text-white/35">
        Cohorts are by sign-up date. Rates only count readers who have had their full window
        ({FUNNEL_WINDOWS.day1Ms / 3600_000} h for Day 1, {FUNNEL_WINDOWS.cardMs / 3600_000} h for a card, trial end plus 3 days for payment,
        {" "}{FUNNEL_WINDOWS.book2Ms / DAY} days for book 2). Live Day 1 tracking started {DAY1_TRACKING_SINCE}; before that, a
        reader counts as Day 1 activated only if they marked Day 1 complete.
      </p>

      {/* Creators */}
      <div className="mt-6">
        <h3 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-white/50">By creator · {presetLabel.toLowerCase()}</h3>
        {creators.every((c) => !c.source) ? (
          <p className="text-xs leading-relaxed text-white/45">
            No creator links used yet. Give each creator a link with their own code, for example{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-white/70">
              {typeof window !== "undefined" ? window.location.origin : ""}/?ref=creatorname
            </code>
            . Sign-ups through it show up here, stage by stage.
          </p>
        ) : null}
        {creators.length > 0 && (
          <div className="-mx-1 mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[0.8125rem]">
              <thead>
                <tr className="text-[0.625rem] uppercase tracking-wide text-white/40">
                  <th className="px-1 pb-2 font-bold">Creator</th>
                  <th className="px-1 pb-2 text-right font-bold">Users sent</th>
                  <th className="px-1 pb-2 text-right font-bold">Day 1</th>
                  <th className="px-1 pb-2 text-right font-bold">Card</th>
                  <th className="px-1 pb-2 text-right font-bold">Paid</th>
                  <th className="px-1 pb-2 text-right font-bold">Book 2</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => (
                  <tr
                    key={c.source}
                    onClick={() => setSource(c.source)}
                    className={`cursor-pointer border-t border-white/5 transition-colors hover:bg-white/5 ${source === c.source ? "bg-[#00D4FF]/[0.06]" : ""}`}
                    title="Show the funnel for this source"
                  >
                    <td className="px-1 py-2 text-white/85">{sourceLabel(c.source || null)}</td>
                    <td className="px-1 py-2 text-right tabular-nums text-white/70">{c.sent}</td>
                    {(["day1", "card", "paid", "book2"] as StageKey[]).map((k) => (
                      <td key={k} className="px-1 py-2 text-right tabular-nums text-white/70">
                        {c[k]} <span className="text-white/40">({pct(c.rates[k])})</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
