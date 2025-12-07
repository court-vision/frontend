import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Query keys
export const playerKeys = {
  all: ["players"] as const,
  stats: (playerId: number) => [...playerKeys.all, "stats", playerId] as const,
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

