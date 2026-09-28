"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { postAuthed } from "@/lib/api-client";
import { cleanSourceCode } from "@/lib/funnel";

const STORE = "bw_attribution";
const SENT = "bw_attribution_sent";
/** A creator's link is credited for sign-ups within this long of the click. */
const KEEP_MS = 30 * 24 * 3600_000;

/**
 * Creator / referral attribution, the smallest version that works.
 *
 * A creator shares any Bookworm link with ?ref=theircode (also accepted:
 * ?creator= or ?utm_source=, with ?utm_campaign= as an optional campaign).
 * The first code seen is kept in this browser for 30 days; once the visitor
 * has an account, it is sent to the server, which attaches it to accounts
 * under a week old and never replaces it (app/api/analytics/attribution).
 *
 * Renders nothing and never blocks anything.
 */
export function AttributionCapture() {
  const { user } = useAuth();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const source = cleanSourceCode(params.get("ref") ?? params.get("creator") ?? params.get("utm_source"));
      if (!source) return;
      const existing = JSON.parse(localStorage.getItem(STORE) ?? "null");
      if (existing?.source && Date.now() - Number(existing.at) < KEEP_MS) return; // first touch wins
      localStorage.setItem(STORE, JSON.stringify({ source, campaign: cleanSourceCode(params.get("utm_campaign")), at: Date.now() }));
    } catch { /* storage blocked: no attribution, nothing else affected */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    let stored: { source?: string; campaign?: string | null; at?: number } | null = null;
    try {
      if (localStorage.getItem(SENT) === user.uid) return;
      stored = JSON.parse(localStorage.getItem(STORE) ?? "null");
    } catch { return; }
    if (!stored?.source || !(Date.now() - Number(stored.at) < KEEP_MS)) return;
    void postAuthed<{ recorded?: boolean; error?: string }>("/api/analytics/attribution", {
      source: stored.source,
      campaign: stored.campaign ?? null,
    }).then((res) => {
      // Any answer but an error is final (recorded, already set, or too old).
      if (!res.error) try { localStorage.setItem(SENT, user.uid); } catch { /* fine */ }
    });
  }, [user]);

  return null;
}
