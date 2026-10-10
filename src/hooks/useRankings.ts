import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { paramsKey } from "@/lib/rankings-params";
import type { RankingsParams, RankingsResult } from "@/types/rankings";

// Query keys
export const rankingsKeys = {
  all: ["rankings"] as const,
  lists: () => [...rankingsKeys.all, "list"] as const,
  list: (params: RankingsParams) => [...rankingsKeys.lists(), paramsKey(params)] as const,
  // teamId is part of the key: two teams can be in leagues that score
  // differently, and switching teams must not serve the previous one's numbers.
  league: (teamId: number | null, params: RankingsParams) =>
    [...rankingsKeys.all, "league", teamId, paramsKey(params)] as const,
};

// Hooks

/** Rankings for a format/window with `meta` (the rankings page). */
export function useRankingsListQuery(params: RankingsParams) {
  return useQuery<RankingsResult>({
    queryKey: rankingsKeys.list(params),
    queryFn: ({ signal }) => apiClient.getRankingsWithMeta(params, { signal }),
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
    enabled: params.scope !== "league",
  });
}

