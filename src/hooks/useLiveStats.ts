import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { LivePlayerData } from "@/types/live";

export function useLivePlayerToday(espnId: number | null) {
  return useQuery<LivePlayerData | null>({
    queryKey: ["live", "player", espnId],
    queryFn: async () => {
      const data = await apiClient.getLivePlayersToday();
      const player = data.players.find(
        (p) => p.espn_id === espnId && p.game_status === 2
      );
      return player ?? null;
    },
    enabled: !!espnId,
    staleTime: 0,
    refetchInterval: 60 * 1000, // poll in sync with the live pipeline cadence
    refetchOnWindowFocus: true,
  });
}
