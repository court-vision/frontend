import { useSyncExternalStore } from "react";
import { onlineManager, useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/endpoints";
import { toApiError } from "@/lib/api-error";
import { classifyHealth, DEGRADED, type ApiHealth } from "@/lib/health";
import { fetchJson } from "@/lib/http";

export const healthKeys = {
  all: ["health"] as const,
};

export const HEALTH_POLL_MS = 60_000;

/**
 * `GET /health` every 60 s for the status bar.
 *
 * A 503 is the backend saying it is degraded — that's data, not a failure.
 * A 404 (the endpoint not deployed yet), a network error or a timeout leave
 * the query in error, which the status bar renders as "unknown"; it never
 * toasts and never retries — the next poll is the retry.
 */
export function useApiHealthQuery() {
  return useQuery<ApiHealth>({
    queryKey: healthKeys.all,
    queryFn: async ({ signal }) => {
      try {
        const body = await fetchJson<unknown>(`${API_BASE}/health`, {
          raw: true,
          signal,
          timeoutMs: 5_000,
        });
        return classifyHealth(body);
      } catch (e) {
        const err = toApiError(e);
        if (err.status === 503) return DEGRADED;
        throw err;
      }
    },
    staleTime: 30_000,
    refetchInterval: HEALTH_POLL_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
    meta: { toast: false },
  });
}

export type Connectivity = "ok" | "degraded" | "offline" | "unknown";

/** Status-dot colour per state (status bar; phone header dot). */
export const CONNECTIVITY_DOT_CLASS: Record<Connectivity, string> = {
  ok: "bg-signal-live",
  degraded: "bg-status-projected",
  offline: "bg-status-loss",
  unknown: "bg-signal-stale",
};

const CONNECTIVITY_LABEL: Record<Exclude<Connectivity, "ok">, string> = {
  degraded: "API degraded",
  offline: "offline",
  unknown: "API status unknown",
};

export function connectivityLabel(
  connectivity: Connectivity,
  dbLatencyMs?: number | null
): string {
  if (connectivity !== "ok") return CONNECTIVITY_LABEL[connectivity];
  return dbLatencyMs !== null && dbLatencyMs !== undefined
    ? `API ok · ${dbLatencyMs} ms`
    : "API ok";
}

/** The browser's connectivity as TanStack sees it (drives its refetch-on-reconnect). */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true
  );
}

/**
 * API health folded with browser connectivity. "degraded" is reserved for a
 * real 503 / `status: "degraded"` body; a 404 (endpoint not deployed yet),
 * network failure or timeout is "unknown".
 */
export function useConnectivity() {
  const health = useApiHealthQuery();
  const isOnline = useIsOnline();
  const connectivity: Connectivity = !isOnline
    ? "offline"
    : health.isError || !health.data
      ? "unknown"
      : health.data.status;
  return { connectivity, health, isOnline };
}
