import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { LivePlayerData } from "@/types/live";

export function useTodayLeadersQuery() {
  return useQuery<LivePlayerData[]>({
    queryKey: ["live", "players", "today", "all"],
    queryFn: async ({ signal }) => {
      const data = await apiClient.getLivePlayersToday({ signal });
      return [...data.players].sort((a, b) => b.fpts - a.fpts);
    },
    staleTime: 0,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    // Live polling: the next poll is the retry, and the panel shows its own badge
    retry: false,
    meta: { toast: false },
  });
}
