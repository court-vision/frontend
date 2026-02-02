import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Query keys
export const gamesKeys = {
  all: ["games"] as const,
  onDate: (date: string) => [...gamesKeys.all, "date", date] as const,
};

// Hooks
export function useGamesOnDateQuery(date: string) {
  return useQuery({
    queryKey: gamesKeys.onDate(date),
    queryFn: () => apiClient.getGamesOnDate(date),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!date,
  });
}

// Helper to get today's date in YYYY-MM-DD format
export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}
