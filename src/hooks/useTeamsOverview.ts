import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { teamsKeys } from "@/hooks/useTeams";
import { apiClient } from "@/lib/api";
import { overviewPollMs } from "@/lib/home";
import type { TeamsOverviewData } from "@/types/team-overview";

export const overviewKeys = {
  /** Under the teams family, so adding or removing a team reads it again. */
  mine: (userId: string | null | undefined) => [...teamsKeys.all, "overview", userId ?? null] as const,
};

/**
 * Every team in the account at a glance (the Home desk). It costs three provider reads per team
 * on the server, which keeps an answer for 20 seconds, so it is polled only around what it is
 * for (`overviewPollMs`): every 90 seconds while a starter's game is on or a lock or deadline is
 * within the hour, every 5 minutes otherwise, and again when the tab comes back.
 */
export function useTeamsOverviewQuery() {
  const { getToken, isSignedIn, userId } = useAuth();
  return useQuery<TeamsOverviewData>({
    queryKey: overviewKeys.mine(userId),
    queryFn: ({ signal }) => apiClient.getTeamsOverview(getToken, { signal }),
    enabled: isSignedIn === true,
    staleTime: 20_000,
    refetchInterval: (query) => overviewPollMs(query.state.data, Date.now()),
    refetchOnWindowFocus: true,
    // The desk shows its own failure in place.
    meta: { toast: false },
  });
}
