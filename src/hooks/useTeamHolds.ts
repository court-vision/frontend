import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { userMessage } from "@/lib/api-error";
import { laneKeys } from "@/hooks/useStreamLanes";
import type { TeamHolds } from "@/types/team-hold";

export const holdKeys = {
  all: ["teamHolds"] as const,
  team: (teamId: number) => [...holdKeys.all, teamId] as const,
};

const EMPTY: TeamHolds = { enabled: false, holds: [] };

/**
 * Dime's live holds on a team (the Dime autopilot plan, step 4): what it set,
 * applied from the AI desk, for auto-lineup's fill and the stream lanes to read.
 * None while its steering is off. While it is on, Dime can set and clear holds
 * from a check-in with the desk open, so the list is read again every minute (as
 * the lanes and the scheduled pickups are); off, nothing changes it and it isn't
 * polled.
 */
export function useTeamHoldsQuery(teamId: number | null): { data: TeamHolds } {
  const { getToken, isSignedIn } = useAuth();
  const query = useQuery<TeamHolds>({
    queryKey: holdKeys.team(teamId!),
    queryFn: ({ signal }) => apiClient.getTeamHolds(getToken, teamId!, { signal }),
    enabled: !!teamId && isSignedIn === true,
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.enabled ? 60_000 : false),
    refetchOnWindowFocus: true,
    meta: { toast: false },
  });
  return { data: query.data ?? EMPTY };
}

/**
 * Clear one hold. The lanes plan with the holds, so their projections are read
 * again; the list comes back with the answer.
 */
export function useClearHoldMutation(teamId: number) {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  return useMutation<TeamHolds, Error, number>({
    mutationKey: ["teamHolds", "clear", teamId],
    mutationFn: (holdId) => apiClient.clearHold(getToken, teamId, holdId),
    meta: { toast: false },
    onSuccess: (holds) => {
      queryClient.setQueryData(holdKeys.team(teamId), holds);
      void queryClient.invalidateQueries({ queryKey: laneKeys.team(teamId) });
    },
    onError: (err) => {
      toast.error(userMessage(err, "Couldn't clear the hold"));
      void queryClient.invalidateQueries({ queryKey: holdKeys.team(teamId) });
    },
  });
}
