import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import type { VerdictAsk } from "@/lib/availability";
import type { TeamAvailabilityData } from "@/types/availability";

export const availabilityKeys = {
  all: ["availability"] as const,
  team: (teamId: number, ask: VerdictAsk) =>
    [...availabilityKeys.all, teamId, ask.start, ask.end, ask.nbaIds.join(",")] as const,
};

/**
 * Our availability verdicts on the matchup's two rosters over today and the
 * days left (`verdictAsk`). The pipeline settles a verdict every couple of
 * minutes on a game night, so this re-reads every two; it is one indexed read,
 * cheap beside the desk's other polls. A failure leaves the grid on ESPN's
 * statuses, as it was before we had verdicts, so it raises no toast.
 */
export function useTeamAvailabilityQuery(teamId: number | null, ask: VerdictAsk | null) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<TeamAvailabilityData>({
    queryKey: availabilityKeys.team(teamId ?? 0, ask ?? { nbaIds: [], start: "", end: "" }),
    queryFn: ({ signal }) => apiClient.getTeamAvailability(getToken, teamId!, ask!, { signal }),
    enabled: !!teamId && !!ask && isSignedIn === true,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (previous) => previous,
    meta: { toast: false },
  });
}
