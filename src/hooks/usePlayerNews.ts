import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { NEWS_DAYS, NEWS_LIMIT } from "@/lib/player-news";

export const playerNewsKeys = {
  byId: (playerId: number) => ["players", "news", playerId] as const,
};

/**
 * A player's news for the Scout sheet: the last two weeks, blurbs included.
 * The news feed stores new items every five minutes, so the sheet asks again
 * on that beat while it is open.
 */
export function usePlayerNewsQuery(playerId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: playerNewsKeys.byId(playerId!),
    queryFn: ({ signal }) => apiClient.getPlayerNews(playerId!, { days: NEWS_DAYS, limit: NEWS_LIMIT }, { signal }),
    enabled: !!playerId && enabled,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
    meta: { toast: false },
  });
}
