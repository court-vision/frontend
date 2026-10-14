import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type PlayerIdType = "espn" | "nba";

// Query keys
export const playerKeys = {
  all: ["players"] as const,
  stats: (playerId: number, idType: PlayerIdType, window: string = "season") =>
    [...playerKeys.all, "stats", idType, playerId, window] as const,
  statsByName: (name: string, team: string, window: string = "season") =>
    [...playerKeys.all, "stats", "name", name, team, window] as const,
  percentiles: (playerId: number) =>
    [...playerKeys.all, "percentiles", playerId] as const,
};

/** One player's stats over one window: the hook's query, and what a prefetch asks so it fills the same cache entry. */
export function playerStatsQuery(playerId: number, idType: PlayerIdType = "espn", window: string = "season") {
  return queryOptions({
    queryKey: playerKeys.stats(playerId, idType, window),
    queryFn: () => apiClient.getPlayerStats(playerId, idType, window),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hooks
export function usePlayerStatsQuery(
  playerId: number | null,
  idType: PlayerIdType = "espn",
  window: string = "season"
) {
  return useQuery({
    ...playerStatsQuery(playerId!, idType, window),
    enabled: !!playerId,
    // Switching windows swaps the numbers in place instead of blanking the card.
    placeholderData: keepPreviousData,
  });
}

export function usePlayerPercentilesQuery(playerId: number | null) {
  return useQuery({
    queryKey: playerKeys.percentiles(playerId!),
    queryFn: () => apiClient.getPlayerPercentiles(playerId!),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 15, // 15 minutes - percentiles change slowly
  });
}

