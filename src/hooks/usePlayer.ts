import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Query keys
export const playerKeys = {
  all: ["players"] as const,
  stats: (playerId: number) => [...playerKeys.all, "stats", playerId] as const,
  statsByName: (name: string, team?: string) => [...playerKeys.all, "stats", "name", name, team] as const,
};

// Hooks
export function usePlayerStatsQuery(playerId: number | null) {
  return useQuery({
    queryKey: playerKeys.stats(playerId!),
    queryFn: () => apiClient.getPlayerStats(playerId!),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePlayerStatsByNameQuery(name: string | null, team?: string) {
  return useQuery({
    queryKey: playerKeys.statsByName(name!, team),
    queryFn: () => apiClient.getPlayerStatsByName(name!, team),
    enabled: !!name,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

