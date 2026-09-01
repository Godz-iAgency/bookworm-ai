import type { Metadata } from "next";

/**
 * Shown by the service worker when a navigation fails with no connection.
 *
 * Every style here is inline, and the font is a system stack, on purpose.
 * This page is served from cache on a device that by definition cannot fetch
 * anything else — and Next's stylesheet and the Google font are both
 * content-hashed URLs the worker may never have seen. Written with Tailwind
 * classes it rendered as unstyled black-on-black serif text, which is barely
 * better than the browser's own error. The only external file it leans on is
 * the icon, which the worker precaches at install.
 *
 * No client JavaScript either: it has to work from the cached HTML alone.
 */
export const metadata: Metadata = {
  title: "You're offline — Bookworm.AI",
};

const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        background: "#080808",
        fontFamily: SANS,
      }}
    >
      {/* A plain img, not next/image: nothing here should depend on the
          framework's runtime being available. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt="Bookworm.AI"
        width={80}
        height={80}
        style={{ width: 80, height: 80, borderRadius: 18 }}
      />
      <h1
        style={{
          marginTop: 24,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#ffffff",
        }}
      >
        You&apos;re offline
      </h1>
      <p
        style={{
          marginTop: 8,
          maxWidth: 360,
          fontSize: 14,
          lineHeight: 1.6,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        Bookworm needs a connection to load your shelf and write new lessons. Reconnect and this
        page will pick up where you left off.
      </p>
      <p style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
        Lessons you have already opened stay readable once you&apos;re back online.
      </p>
    </main>
  );
}
