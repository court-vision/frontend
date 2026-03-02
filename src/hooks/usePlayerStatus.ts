import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { PlayerStatusData } from "@/types/player";

export const playerStatusKeys = {
  all: ["players", "status"] as const,
  byId: (playerId: number) => [...playerStatusKeys.all, playerId] as const,
};

export function usePlayerStatusQuery(playerId: number | null) {
  return useQuery<PlayerStatusData | null>({
    queryKey: playerStatusKeys.byId(playerId!),
    queryFn: () => apiClient.getPlayerStatus(playerId!),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
