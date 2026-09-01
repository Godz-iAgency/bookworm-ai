"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once the page has settled.
 *
 * Production only. In dev, a service worker sits between Turbopack and the
 * browser and makes hot reload behave unpredictably — you end up debugging the
 * worker instead of the app. Test it with `next build && next start`.
 *
 * Registration is deferred to the load event so it never competes with the
 * first render for bandwidth on a phone.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("Service worker registration failed:", err));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
