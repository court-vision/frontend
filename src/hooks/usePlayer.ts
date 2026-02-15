import { useQuery } from "@tanstack/react-query";
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

// Hooks
export function usePlayerStatsQuery(
  playerId: number | null,
  idType: PlayerIdType = "espn",
  window: string = "season"
) {
  return useQuery({
    queryKey: playerKeys.stats(playerId!, idType, window),
    queryFn: () => apiClient.getPlayerStats(playerId!, idType, window),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
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

export function usePlayerStatsByNameQuery(
  name: string | null,
  team: string | null,
  window: string = "season"
) {
  return useQuery({
    queryKey: playerKeys.statsByName(name!, team!, window),
    queryFn: () => apiClient.getPlayerStatsByName(name!, team!, window),
    enabled: !!name && !!team,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
