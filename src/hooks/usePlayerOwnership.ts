import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { PlayerOwnershipData } from "@/types/player";

export const playerOwnershipKeys = {
  all: ["players", "ownership"] as const,
  byId: (playerId: number) => [...playerOwnershipKeys.all, playerId] as const,
};

export function usePlayerOwnershipQuery(playerId: number | null) {
  return useQuery<PlayerOwnershipData | null>({
    queryKey: playerOwnershipKeys.byId(playerId!),
    queryFn: () => apiClient.getPlayerOwnership(playerId!),
    enabled: !!playerId,
    staleTime: 1000 * 60 * 15, // 15 minutes - ownership changes slowly
  });
}
