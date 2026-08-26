import { useQuery } from "@tanstack/react-query";
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
