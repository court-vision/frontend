"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * A function whose identity never changes but which always runs the latest render's `fn`.
 *
 * For event handlers handed to memoized children. A `useCallback` that closes over the
 * draft room's model or the Draft Tap's sync object gets a new identity on every render
 * (both are rebuilt each time), and a new identity re-renders every memoized row it
 * reaches. Call the result from events and effects only, never during render: it runs
 * whatever the last committed render passed in.
 */
export function useLatestCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: A) => latest.current(...args), []);
}
