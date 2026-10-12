import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
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

/**
 * A league ranking's `placeholderData`: the previous result while another
 * window loads, but never another team's. That team's league can score
 * differently, and its numbers would show as loaded under the new league's name.
 * The team is the third part of `rankingsKeys.league`.
 */
export function leagueRankingsPlaceholder(teamId: number | null) {
  return (prev: RankingsResult | undefined, prevQuery: { queryKey: QueryKey } | undefined): RankingsResult | undefined =>
    prevQuery?.queryKey[2] === teamId ? prev : undefined;
}

// Hooks

/** Rankings for a format/window with `meta` (the Scout desk's pool). */
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
 * The same pool scored by a team's league settings. Authenticated, so it
 * loads client-side once there is a signed-in user with a team.
 */
export function useLeagueRankingsQuery(teamId: number | null, params: RankingsParams) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<RankingsResult>({
    queryKey: rankingsKeys.league(teamId, params),
    queryFn: ({ signal }) => apiClient.getLeagueRankingsWithMeta(getToken, teamId as number, params, { signal }),
    staleTime: 1000 * 60 * 10,
    placeholderData: leagueRankingsPlaceholder(teamId),
    enabled: params.scope === "league" && teamId !== null && isSignedIn === true,
  });
}
