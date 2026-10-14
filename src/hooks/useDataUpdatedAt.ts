import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";

/** When any of these queries last got data (ms), or null when none has any. */
export function lastUpdatedAt(client: QueryClient, keys: readonly QueryKey[]): number | null {
  let at = 0;
  for (const key of keys) at = Math.max(at, client.getQueryState(key)?.dataUpdatedAt ?? 0);
  return at || null;
}

/**
 * The newest `dataUpdatedAt` among `keys`, read straight from the cache. It
 * re-renders only the component that asks, and only when that time moves: the
 * page that owns the queries doesn't have to read it (and re-render the whole
 * desk) on every poll. `keys` should keep its identity between renders.
 */
export function useDataUpdatedAt(keys: readonly QueryKey[]): number | null {
  const client = useQueryClient();
  const subscribe = useCallback((onChange: () => void) => client.getQueryCache().subscribe(onChange), [client]);
  const read = useCallback(() => lastUpdatedAt(client, keys), [client, keys]);
  return useSyncExternalStore(subscribe, read, () => null);
}
