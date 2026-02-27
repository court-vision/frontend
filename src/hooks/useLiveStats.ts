import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { LivePlayerData } from "@/types/live";

export function useLivePlayerToday(playerId: number | null) {
  return useQuery<LivePlayerData | null>({
    queryKey: ["live", "player", playerId],
    queryFn: async () => {
      const data = await apiClient.getLivePlayersToday();
      const player = data.players.find(
        (p) => p.player_id === playerId && p.game_status >= 2
      );
      return player ?? null;
    },
    enabled: !!playerId,
    staleTime: 0,
    refetchInterval: 30 * 1000, // poll in sync with the live pipeline cadence
    refetchOnWindowFocus: true,
  });
}
