import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { getTodayDate } from "@/lib/nba-date";

export { getTodayDate };

// Query keys
export const gamesKeys = {
  all: ["games"] as const,
  onDate: (date: string) => [...gamesKeys.all, "date", date] as const,
  detail: (date: string, gameId: string) => [...gamesKeys.all, "detail", date, gameId] as const,
};

// Hooks
export function useGamesOnDateQuery(date: string) {
  const isToday = date === getTodayDate();

  return useQuery({
    queryKey: gamesKeys.onDate(date),
    queryFn: ({ signal }) => apiClient.getGamesOnDate(date, { signal }),
    staleTime: isToday ? 0 : 1000 * 60 * 5,
    refetchInterval: isToday ? 60 * 1000 : false, // Poll every 60s for today
    enabled: !!date,
    // Live polling: the next poll is the retry, and the panel shows its own badge
    ...(isToday ? { retry: false, meta: { toast: false } } : {}),
  });
}

/**
 * One game of a night, frozen at the final buzzer once it is over: the score
 * by period, the score through the game and every line. Asked only for a
 * game that is over, which barely moves: its live lines give way to the game
 * log once the post-game run lands, so half an hour is fresh enough.
 */
export function useGameDetailQuery(date: string, gameId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: gamesKeys.detail(date, gameId),
    queryFn: ({ signal }) => apiClient.getGameDetail(date, gameId, { signal }),
    enabled: enabled && !!date && /^\d{10}$/.test(gameId),
    staleTime: 1000 * 60 * 30,
    meta: { toast: false },
  });
}
