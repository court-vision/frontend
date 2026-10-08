import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { getTodayDate } from "@/hooks/useGames";
import { addDays } from "@/lib/scout";
import type { ESPNMarketPlayer, MarketDirection, MarketSort } from "@/types/scout";

/**
 * The Scout desk's own queries: the player directory, and the per-player
 * extras beyond stats (profile, trends, projection, ESPN market line) plus
 * the ESPN market's movers. All public.
 */
export const scoutKeys = {
  search: (q: string) => ["players", "search", q] as const,
  profile: (id: number) => ["players", "profile", id] as const,
  trends: (id: number) => ["players", "trends", id] as const,
  projection: (id: number) => ["players", "projection", id] as const,
  market: (name: string) => ["market", "espn", "by-name", name] as const,
  movers: (from: string, to: string, metric: MarketSort, direction: MarketDirection, limit: number) =>
    ["market", "espn", "movement", from, to, metric, direction, limit] as const,
};

/** Name search over the player dimension; two characters before it asks. */
export function usePlayerSearchQuery(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: scoutKeys.search(term),
    queryFn: ({ signal }) => apiClient.searchPlayers(term, 12, { signal }),
    enabled: term.length >= 2,
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
    meta: { toast: false },
  });
}

export function usePlayerProfileQuery(playerId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: scoutKeys.profile(playerId!),
    queryFn: ({ signal }) => apiClient.getPlayerProfile(playerId!, { signal }),
    enabled: !!playerId && enabled,
    staleTime: 1000 * 60 * 60,
    meta: { toast: false },
  });
}

export function usePlayerTrendsQuery(playerId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: scoutKeys.trends(playerId!),
    queryFn: ({ signal }) => apiClient.getPlayerTrends(playerId!, { signal }),
    enabled: !!playerId && enabled,
    staleTime: 1000 * 60 * 15,
    meta: { toast: false },
  });
}

export function usePlayerProjectionQuery(playerId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: scoutKeys.projection(playerId!),
    queryFn: ({ signal }) => apiClient.getPlayerProjection(playerId!, { signal }),
    enabled: !!playerId && enabled,
    staleTime: 1000 * 60 * 60,
    meta: { toast: false },
  });
}

/**
 * A player's ESPN market line. The market has no per-player route, so this
 * searches it by name and keeps the row with his NBA id.
 */
export function useEspnMarketLineQuery(name: string | null, playerId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: scoutKeys.market(name ?? ""),
    queryFn: ({ signal }) => apiClient.getEspnMarket({ name: name!, limit: 10 }, { signal }),
    enabled: !!name && !!playerId && enabled,
    staleTime: 1000 * 60 * 60,
    select: (data): ESPNMarketPlayer | null => data?.players.find((p) => p.player_id === playerId) ?? null,
    meta: { toast: false },
  });
}

/** Who moved most in the ESPN market over the last `days` days, by `metric`. */
export function useEspnMarketMoversQuery(
  days: number,
  metric: MarketSort,
  direction: MarketDirection = "both",
  limit: number = 40,
  enabled: boolean = true
) {
  const to = getTodayDate();
  const from = addDays(to, -days);
  return useQuery({
    queryKey: scoutKeys.movers(from, to, metric, direction, limit),
    queryFn: ({ signal }) => apiClient.getEspnMarketMovement({ fromAsOf: from, toAsOf: to, metric, direction, limit }, { signal }),
    enabled,
    staleTime: 1000 * 60 * 30,
    meta: { toast: false },
  });
}

/**
 * Today's live box-score lines for everyone on the floor, polled with the
 * live pipeline. Off while nothing on the desk shows them.
 */
export function useLiveLeadersQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: ["live", "players", "today", "all"],
    queryFn: async ({ signal }) => {
      const data = await apiClient.getLivePlayersToday({ signal });
      return { gameDate: data.game_date, players: [...data.players].sort((a, b) => b.fpts - a.fpts) };
    },
    enabled,
    staleTime: 0,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    // Live polling: the next poll is the retry, and the sheet shows its own badge
    retry: false,
    meta: { toast: false },
  });
}
