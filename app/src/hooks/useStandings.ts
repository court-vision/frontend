import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { StandingsPlayer, StandingsPlayerStats } from "@/types/standings";

// Query keys
export const standingsKeys = {
  all: ["standings"] as const,
  lists: () => [...standingsKeys.all, "list"] as const,
  playerStats: (playerName: string) =>
    [...standingsKeys.all, "player", playerName] as const,
};

// Hooks
export function useStandingsQuery() {
  return useQuery({
    queryKey: standingsKeys.lists(),
    queryFn: () => apiClient.getStandings(),
    staleTime: 1000 * 60 * 10, // 10 minutes - standings don't change often
  });
}

export function usePlayerStatsQuery(playerName: string | null) {
  return useQuery({
    queryKey: standingsKeys.playerStats(playerName!),
    queryFn: () => apiClient.getPlayerStats(playerName!),
    enabled: !!playerName,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
