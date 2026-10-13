import { useMemo } from "react";
import type { FocusEvent, PointerEvent } from "react";
import { leadsIntoClerk, warmClerk } from "@/lib/clerk-warm";

// How long a mouse has to rest on a link before it counts as intent (the
// figure instant.page uses), so a pointer crossing the hero on its way
// elsewhere fetches nothing.
const DWELL_MS = 65;

/** The same-origin link into a Clerk page that an event happened on, if any. */
function clerkLink(target: EventTarget | null): HTMLAnchorElement | null {
  const a = target instanceof Element ? target.closest("a[href]") : null;
  if (!(a instanceof HTMLAnchorElement) || a.origin !== window.location.origin) return null;
  return leadsIntoClerk(a.pathname) ? a : null;
}

/**
 * Handlers for a page that runs no Clerk (the landing), delegated from its root:
 * a mouse resting on a link into a Clerk page, or any press or focus on one,
 * starts clerk-js loading before the click (src/lib/clerk-warm.ts).
 */
export function useClerkIntent() {
  return useMemo(() => {
    let timer: number | undefined;
    const warmNow = (e: PointerEvent | FocusEvent) => {
      if (clerkLink(e.target)) warmClerk();
    };
    return {
      onPointerOver: (e: PointerEvent) => {
        if (e.pointerType !== "mouse" || !clerkLink(e.target)) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => warmClerk(), DWELL_MS);
      },
      onPointerOut: (e: PointerEvent) => {
        const a = clerkLink(e.target);
        if (a && !(e.relatedTarget instanceof Node && a.contains(e.relatedTarget))) window.clearTimeout(timer);
      },
      onPointerDown: warmNow,
      onFocus: warmNow,
    };
  }, []);
}
