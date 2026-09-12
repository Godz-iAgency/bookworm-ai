"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { auth } from "@/lib/firebase/config";

/**
 * An access link opening itself.
 *
 * No form, no card, no questions: the reader taps a link and arrives on their
 * shelf. Everything that decides whether that is allowed lives on the server
 * (/api/access/redeem); this screen's only job is to hand over the token, take
 * the session it gets back, and get out of the way.
 */
export default function AccessLinkPage() {
  const router = useRouter();
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // React 18's development double-effect would otherwise redeem the link
    // twice and inflate the use count on every visit.
    if (started.current || !token) return;
    started.current = true;

    (async () => {
      try {
        const res = await fetch("/api/access/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok || !data.customToken) {
          setError(data.error || "This link isn't valid.");
          return;
        }
        await signInWithCustomToken(auth, data.customToken);
        router.replace("/dashboard");
      } catch (err) {
        console.error("Access link sign-in failed:", err);
        setError("We couldn't open that link. Check your connection and try again.");
      }
    })();
  }, [token, router]);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <Logo variant="stacked" priority className="mb-8 w-40 opacity-90" />
      {error ? (
        <>
          <h1 className="mb-2 text-xl font-bold">{error}</h1>
          <p className="max-w-sm text-sm leading-relaxed text-white/60">
            If you were sent this link and it should still work, ask whoever shared it to send a new one.
          </p>
        </>
      ) : (
        <>
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-[#00D4FF]" />
          <p className="text-sm text-white/60">Opening Bookworm&hellip;</p>
        </>
      )}
    </div>
  );
}
