import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { LivePlayerData } from "@/types/live";

export function useTodayLeadersQuery() {
  return useQuery<LivePlayerData[]>({
    queryKey: ["live", "players", "today", "all"],
    queryFn: async () => {
      const data = await apiClient.getLivePlayersToday();
      return [...data.players].sort((a, b) => b.fpts - a.fpts);
    },
    staleTime: 0,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
