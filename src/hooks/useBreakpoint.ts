"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * `window.matchMedia(query).matches`, hydration-safe.
 *
 * The server (and the hydrating client render) sees `serverDefault`, so a
 * component that branches on this hook either mounts after hydration (every
 * page behind Clerk's `isLoaded` gate in `Base`) or accepts a one-frame
 * desktop flash. Rule: CSS (`md:`/`lg:`) for cheap dual layouts; this hook
 * only where mounting both branches is expensive or a prop must change.
 */
export function useMediaQuery(query: string, serverDefault = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverDefault
  );
}

/** Below Tailwind `md` (768 px). Server default: desktop. */
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)", true);
}

/** Below Tailwind `lg` (1024 px). Server default: desktop. */
export function useIsBelowLg(): boolean {
  return !useMediaQuery("(min-width: 1024px)", true);
}

/** Coarse pointer with no hover (phones, tablets). Server default: not touch. */
export function useIsTouch(): boolean {
  return useMediaQuery("(hover: none) and (pointer: coarse)", false);
}
