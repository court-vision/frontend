import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards. Gate anything
 * that depends on client-only state that may already be settled before React
 * hydrates (Clerk's `isLoaded`/`isSignedIn` on a slow phone): rendering it in
 * the first client pass would differ from the server HTML and trip
 * "Hydration failed".
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
