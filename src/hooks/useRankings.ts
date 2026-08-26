import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { paramsKey } from "@/lib/rankings-params";
import type { RankingsParams, RankingsResult } from "@/types/rankings";

// Query keys
export const rankingsKeys = {
  all: ["rankings"] as const,
  lists: () => [...rankingsKeys.all, "list"] as const,
  list: (params: RankingsParams) => [...rankingsKeys.lists(), paramsKey(params)] as const,
};

// Hooks

/** Season points rankings as a flat list — the terminal's player lookup table. */
export function useRankingsQuery() {
  return useQuery({
    queryKey: rankingsKeys.lists(),
    queryFn: () => apiClient.getRankings(),
    staleTime: 1000 * 60 * 10, // 10 minutes - rankings don't change often
  });
}

/** Rankings for a format/window with `meta` (the rankings page). */
export function useRankingsListQuery(params: RankingsParams) {
  return useQuery<RankingsResult>({
    queryKey: rankingsKeys.list(params),
    queryFn: ({ signal }) => apiClient.getRankingsWithMeta(params, { signal }),
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });
}
