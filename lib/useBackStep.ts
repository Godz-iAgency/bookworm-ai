"use client";

import { useEffect, useRef } from "react";

/**
 * The phone's own back button (Android's back arrow, a back swipe, the
 * browser's back) steps back inside the app, the way Kindle does, instead of
 * leaving the page.
 *
 * Screens that open "on top" of a page without a route change - a lesson open
 * in the reader, a dashboard view other than the shelf, step 2 of onboarding -
 * register here while they are open. The first one adds a single extra entry
 * to the browser's history (the "trap"). Pressing back pops it; the most
 * recently opened screen is told to close, and if anything is still open
 * underneath, the trap is set again for the next press.
 *
 * Closing a screen from inside the app (its own back arrow, the Home tab)
 * removes the trap once nothing is left open, so the next back press leaves
 * the page as normal instead of doing nothing. The installed Play Store app
 * runs the website, so the same history drives its back button too.
 */

type Entry = { onBack: () => void };

const stack: Entry[] = [];
/** The token on our trap entry while it is in history, else null. */
let trap: string | null = null;
/** Pops we caused ourselves, which must not close anything. */
let ignorePops = 0;
let listening = false;

function arm() {
  if (trap) return;
  trap = Math.random().toString(36).slice(2);
  window.history.pushState({ ...(window.history.state ?? {}), bookwormBack: trap }, "");
}

function onPop() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  // Only a pop that took us off our own trap is a back press for us. Moving
  // between pages is the router's business.
  if (!trap || window.history.state?.bookwormBack === trap) return;
  trap = null;
  stack[stack.length - 1]?.onBack();
}

/** After React has settled: re-arm while something is open, disarm when nothing is. */
function settle() {
  setTimeout(() => {
    if (stack.length) {
      arm();
    } else if (trap && window.history.state?.bookwormBack === trap) {
      trap = null;
      ignorePops++;
      window.history.back();
    } else {
      // The page moved on (a route change) with the trap buried under it.
      trap = null;
    }
  }, 0);
}

export function useBackStep(active: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(() => {
    if (!active) return;
    if (!listening) {
      window.addEventListener("popstate", onPop);
      listening = true;
    }
    const entry: Entry = { onBack: () => latest.current() };
    stack.push(entry);
    settle();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      settle();
    };
  }, [active]);
}
