import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
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
    enabled: params.scope !== "league",
  });
}

/**
 * The same pool scored by the selected team's league settings.
 *
 * Authenticated, so it cannot be part of the layout's server-side prefetch —
 * it loads client-side once a team is selected.
 */
export function useLeagueRankingsQuery(teamId: number | null, params: RankingsParams) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<RankingsResult>({
    queryKey: rankingsKeys.league(teamId, params),
    queryFn: ({ signal }) =>
      apiClient.getLeagueRankingsWithMeta(getToken, teamId as number, params, { signal }),
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
    enabled: params.scope === "league" && teamId !== null && isSignedIn === true,
  });
}
