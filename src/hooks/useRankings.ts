import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { RankingsPlayer } from "@/types/rankings";

// Query keys
export const rankingsKeys = {
  all: ["rankings"] as const,
  lists: () => [...rankingsKeys.all, "list"] as const,
  list: (model: string) => [...rankingsKeys.lists(), model] as const,
};

// Hooks
export function useRankingsQuery(model: string) {
  return useQuery({
    queryKey: rankingsKeys.list(model),
    queryFn: () => apiClient.getRankings(model),
    staleTime: 1000 * 60 * 60, // 1 hour - rankings are updated daily
  });
}
