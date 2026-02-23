import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Query keys
export const gamesKeys = {
  all: ["games"] as const,
  onDate: (date: string) => [...gamesKeys.all, "date", date] as const,
};

// Hooks
export function useGamesOnDateQuery(date: string) {
  const isToday = date === getTodayDate();

  return useQuery({
    queryKey: gamesKeys.onDate(date),
    queryFn: () => apiClient.getGamesOnDate(date),
    staleTime: isToday ? 0 : 1000 * 60 * 5,
    refetchInterval: isToday ? 60 * 1000 : false, // Poll every 60s for today
    enabled: !!date,
  });
}

// Helper to get today's date in YYYY-MM-DD format, using ET to match the
// backend's NBA game date convention (avoids rolling to the next day at
// midnight UTC while games are still in progress on the East Coast).
export function getTodayDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
