import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type PlayerIdType = "espn" | "nba";

// Query keys
export const playerKeys = {
  all: ["players"] as const,
  stats: (playerId: number, idType: PlayerIdType) =>
    [...playerKeys.all, "stats", idType, playerId] as const,
  statsByName: (name: string, team: string) =>
    [...playerKeys.all, "stats", "name", name, team] as const,
};

// Hooks
export function usePlayerStatsQuery(
  playerId: number | null,
  idType: PlayerIdType = "espn"
) {
  return useQuery({
    queryKey: playerKeys.stats(playerId!, idType),
    queryFn: () => apiClient.getPlayerStats(playerId!, idType),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePlayerStatsByNameQuery(
  name: string | null,
  team: string | null
) {
  return useQuery({
    queryKey: playerKeys.statsByName(name!, team!),
    queryFn: () => apiClient.getPlayerStatsByName(name!, team!),
    enabled: !!name && !!team,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

