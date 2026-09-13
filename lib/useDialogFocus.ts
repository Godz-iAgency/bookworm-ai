"use client";
import { useEffect, useRef } from "react";
/** Focus containment without changing the existing portal or animation. */
export function useDialogFocus(active: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () => [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex="0"]')].filter(el => el.getClientRects().length);
    (buttons()[0] ?? root).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const list = buttons(); const first = list[0] ?? root; const last = list.at(-1) ?? root;
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [active]);
  return ref;
}
