"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

/**
 * Where the printed QR code points. Nothing else about this path matters —
 * it exists only so a scan is a page visit, which the privacy policy already
 * discloses Vercel Web Analytics as counting. That is the whole tracking
 * mechanism: no new service, no new disclosure needed.
 *
 * Deliberately not a server-side redirect. A server redirect answers with a
 * 3xx before the browser ever loads the root layout, so <Analytics /> (in
 * app/layout.tsx) would never mount and the scan would never be counted —
 * the one thing this route is for. Rendering client-side first gives that
 * script a moment to fire its beacon (sendBeacon, which is built to survive
 * the immediate navigation away) before router.replace takes over.
 *
 * replace rather than push: a scan shouldn't leave /qr sitting in back-button
 * history between the landing page and wherever the browser came from.
 */
export default function QrLanding() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#080808]">
      <Logo variant="mark" size={48} priority />
    </main>
  );
}
