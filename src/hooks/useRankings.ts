import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// Query keys
export const rankingsKeys = {
  all: ["rankings"] as const,
  lists: () => [...rankingsKeys.all, "list"] as const,
};

// Hooks
export function useRankingsQuery() {
  return useQuery({
    queryKey: rankingsKeys.lists(),
    queryFn: () => apiClient.getRankings(),
    staleTime: 1000 * 60 * 10, // 10 minutes - rankings don't change often
  });
}
