import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type PlayerIdType = "espn" | "nba";

// Query keys
export const playerKeys = {
  all: ["players"] as const,
  stats: (playerId: number, idType: PlayerIdType) =>
    [...playerKeys.all, "stats", idType, playerId] as const,
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

