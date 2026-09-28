"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface DetailTable {
  columns: string[];
  rows: (string | number)[][];
  empty?: string;
}

export interface DetailSection {
  heading?: string;
  note?: string;
  rows?: { label: string; value: string | number }[];
  table?: DetailTable;
}

export interface Detail {
  title: string;
  intro?: string;
  sections: DetailSection[];
}

/** Long lists stay usable; the count above each table is always the full one. */
const MAX_ROWS = 200;

/**
 * The breakdown behind any card on the Control Centre: the numbers that make
 * up the headline, then the accounts themselves.
 */
export function DetailDialog({ detail, onClose }: { detail: Detail | null; onClose: () => void }) {
  return (
    <Dialog.Root open={!!detail} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#111] text-white shadow-2xl focus:outline-none"
          aria-describedby={undefined}
        >
          {detail && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <Dialog.Title className="text-base font-bold tracking-tight">{detail.title}</Dialog.Title>
                  {detail.intro && <p className="mt-1 text-xs leading-relaxed text-white/50">{detail.intro}</p>}
                </div>
                <Dialog.Close
                  className="shrink-0 rounded-full border border-white/15 p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </Dialog.Close>
              </div>
              <div className="space-y-6 overflow-y-auto px-5 py-4">
                {detail.sections.map((s, i) => (
                  <section key={i}>
                    {s.heading && (
                      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">
                        {s.heading}
                        {s.table && <span className="ml-1.5 font-semibold text-white/35">({s.table.rows.length})</span>}
                      </h3>
                    )}
                    {s.note && <p className="mb-2 text-xs leading-relaxed text-white/45">{s.note}</p>}
                    {s.rows && (
                      <div className="mb-3 space-y-1.5">
                        {s.rows.map((r) => (
                          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0">
                            <span className="min-w-0 text-[13px] text-white/60">{r.label}</span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-white/90">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.table && (
                      s.table.rows.length === 0 ? (
                        <p className="text-sm text-white/40">{s.table.empty ?? "Nobody here yet."}</p>
                      ) : (
                        <div className="-mx-1 overflow-x-auto">
                          <table className="w-full min-w-[480px] text-left text-[13px]">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wide text-white/40">
                                {s.table.columns.map((c, ci) => (
                                  <th key={c} className={`px-1 pb-2 font-bold ${ci > 0 ? "whitespace-nowrap" : ""}`}>{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {s.table.rows.slice(0, MAX_ROWS).map((row, ri) => (
                                <tr key={ri} className="border-t border-white/5">
                                  {row.map((cell, ci) => (
                                    <td
                                      key={ci}
                                      className={`px-1 py-2 ${ci === 0 ? "max-w-[240px] truncate text-white/85" : "whitespace-nowrap text-white/60"} ${typeof cell === "number" ? "tabular-nums" : ""}`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {s.table.rows.length > MAX_ROWS && (
                            <p className="mt-2 text-[11px] text-white/40">Showing the first {MAX_ROWS} of {s.table.rows.length}.</p>
                          )}
                        </div>
                      )
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
