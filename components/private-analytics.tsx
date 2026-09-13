"use client";
import { Analytics } from "@vercel/analytics/next";
/** Capability URLs must never become analytics page names. */
export function PrivateAnalytics() {
  return <Analytics beforeSend={event => {
    const path = new URL(event.url, window.location.origin).pathname;
    return /^\/(go|join)\//.test(path) ? null : event;
  }} />;
}
